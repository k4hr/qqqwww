export type RemoteImageDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
  contentType: string | null;
};

const probeCache = new Map<string, { expiresAt: number; value: RemoteImageDimensions | null }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PROBE_BYTES = 256 * 1024;

function readU16BE(data: Uint8Array, offset: number) {
  return (data[offset] << 8) | data[offset + 1];
}

function readU16LE(data: Uint8Array, offset: number) {
  return data[offset] | (data[offset + 1] << 8);
}

function readU24LE(data: Uint8Array, offset: number) {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function readU32BE(data: Uint8Array, offset: number) {
  return ((data[offset] << 24) >>> 0) + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
}

function ascii(data: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...data.slice(offset, offset + length));
}

function pngDimensions(data: Uint8Array) {
  if (data.length < 24) return null;
  if (data[0] !== 0x89 || ascii(data, 1, 3) !== "PNG") return null;
  const width = readU32BE(data, 16);
  const height = readU32BE(data, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegDimensions(data: Uint8Array) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;

  while (offset + 8 < data.length) {
    while (offset < data.length && data[offset] !== 0xff) offset += 1;
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) break;

    const marker = data[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) break;

    const segmentLength = readU16BE(data, offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) break;
    if (sofMarkers.has(marker) && segmentLength >= 7) {
      const height = readU16BE(data, offset + 3);
      const width = readU16BE(data, offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(data: Uint8Array) {
  if (data.length < 30 || ascii(data, 0, 4) !== "RIFF" || ascii(data, 8, 4) !== "WEBP") return null;
  const chunk = ascii(data, 12, 4);

  if (chunk === "VP8X" && data.length >= 30) {
    return { width: 1 + readU24LE(data, 24), height: 1 + readU24LE(data, 27) };
  }

  if (chunk === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
    const b0 = data[21];
    const b1 = data[22];
    const b2 = data[23];
    const b3 = data[24];
    return {
      width: 1 + b0 + ((b1 & 0x3f) << 8),
      height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10),
    };
  }

  if (chunk === "VP8 " && data.length >= 30) {
    for (let offset = 20; offset + 9 < Math.min(data.length, 80); offset += 1) {
      if (data[offset + 3] === 0x9d && data[offset + 4] === 0x01 && data[offset + 5] === 0x2a) {
        return {
          width: readU16LE(data, offset + 6) & 0x3fff,
          height: readU16LE(data, offset + 8) & 0x3fff,
        };
      }
    }
  }

  return null;
}

export function readImageDimensions(data: Uint8Array) {
  return pngDimensions(data) ?? jpegDimensions(data) ?? webpDimensions(data);
}

async function readResponsePrefix(response: Response) {
  if (!response.body) return new Uint8Array(await response.arrayBuffer()).slice(0, MAX_PROBE_BYTES);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = MAX_PROBE_BYTES - total;
      const chunk = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;
      if (readImageDimensions(joinChunks(chunks, total))) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return joinChunks(chunks, total);
}

function joinChunks(chunks: Uint8Array[], total: number) {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function probeRemoteImageDimensions(url: string): Promise<RemoteImageDimensions | null> {
  const normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) return null;
  const cached = probeCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: RemoteImageDimensions | null = null;
  try {
    const response = await fetch(normalized, {
      headers: {
        Range: `bytes=0-${MAX_PROBE_BYTES - 1}`,
        "User-Agent": "REDFILM-Artwork-Validator/1.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (response.ok || response.status === 206) {
      const contentType = response.headers.get("content-type");
      const normalizedContentType = contentType?.toLocaleLowerCase("en-US") ?? "";
      if (normalizedContentType.startsWith("text/") || normalizedContentType.includes("json") || normalizedContentType.includes("xml")) {
        throw new Error("Remote URL is not an image");
      }
      const dimensions = readImageDimensions(await readResponsePrefix(response));
      if (dimensions?.width && dimensions.height) {
        value = {
          ...dimensions,
          aspectRatio: dimensions.width / dimensions.height,
          contentType,
        };
      }
    }
  } catch {
    value = null;
  }

  probeCache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
