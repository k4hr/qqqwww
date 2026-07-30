import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);
const MAX_BYTES = 8 * 1024 * 1024;
const PUBLIC_PREFIX = "/media/editorial/";

export function editorialUploadDirectory() {
  return process.env.EDITORIAL_UPLOAD_DIR?.trim() || "/app/storage/editorial";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 90) || "movie";
}

function managedFilename(url?: string | null) {
  if (!url?.startsWith(PUBLIC_PREFIX)) return null;
  const filename = url.slice(PUBLIC_PREFIX.length);
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(filename) ? filename : null;
}

async function deleteManagedFile(url?: string | null) {
  const filename = managedFilename(url);
  if (!filename) return;
  await rm(path.join(editorialUploadDirectory(), filename), { force: true }).catch(() => undefined);
}

function decodeDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(value);
  if (!match) return null;
  return { type: match[1], buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64") };
}

async function persistBuffer(movieId: string, field: string, type: string, buffer: Buffer, previous?: string | null) {
  const extension = ALLOWED.get(type);
  if (!extension) throw new Error(`Unsupported image type: ${type}`);
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error("Image is empty or larger than 8 MB");

  const directory = editorialUploadDirectory();
  await mkdir(directory, { recursive: true });
  const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const filename = `${safeSegment(movieId)}-${safeSegment(field)}-${digest}${extension}`;
  const destination = path.join(directory, filename);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, buffer, { mode: 0o644 });
  await rename(temporary, destination);

  const url = `${PUBLIC_PREFIX}${filename}`;
  if (previous && previous !== url) await deleteManagedFile(previous);
  return url;
}

export async function saveEditorialImageFile(
  formData: FormData,
  field: string,
  movieId: string,
  existing?: string | null,
) {
  if (formData.get(`${field}Remove`) === "on") {
    await deleteManagedFile(existing);
    return null;
  }

  const file = formData.get(field);
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.has(file.type)) throw new Error(`Unsupported image type: ${file.type}`);
    if (file.size > MAX_BYTES) throw new Error("Image is larger than 8 MB");
    return persistBuffer(movieId, field, file.type, Buffer.from(await file.arrayBuffer()), existing);
  }

  // One-time migration for images saved by the old implementation as data URLs.
  if (existing?.startsWith("data:image/")) {
    const decoded = decodeDataUrl(existing);
    if (!decoded) throw new Error("Invalid legacy editorial image");
    return persistBuffer(movieId, field, decoded.type, decoded.buffer, null);
  }

  return existing ?? null;
}

export async function readEditorialImageFile(filename: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(filename)) return null;
  const absolute = path.join(editorialUploadDirectory(), filename);
  const buffer = await readFile(absolute).catch(() => null);
  if (!buffer) return null;
  const extension = path.extname(filename).toLowerCase();
  const contentType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
    : extension === ".png" ? "image/png"
      : extension === ".webp" ? "image/webp"
        : extension === ".gif" ? "image/gif"
          : null;
  return contentType ? { buffer, contentType } : null;
}
