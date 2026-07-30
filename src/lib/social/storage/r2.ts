import crypto from "node:crypto";
import { getSocialConfig } from "@/lib/social/config";

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function sha256(value: string | Buffer) { return crypto.createHash("sha256").update(value).digest("hex"); }
function hmac(key: Buffer | string, value: string) { return crypto.createHmac("sha256", key).update(value).digest(); }
function amzDate(date: Date) { return date.toISOString().replace(/[:-]|\.\d{3}/g, ""); }

function signingKey(secret: string, day: string) {
  const date = hmac(`AWS4${secret}`, day);
  const region = hmac(date, "auto");
  const service = hmac(region, "s3");
  return hmac(service, "aws4_request");
}

export function createR2PresignedUrl(input: {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  objectKey: string;
  expiresIn: number;
  contentType?: string;
}) {
  const config = getSocialConfig().r2;
  const now = new Date();
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const credentialScope = `${day}/auto/s3/aws4_request`;
  const endpoint = new URL(config.endpoint);
  const path = `/${encode(config.bucket)}/${input.objectKey.split("/").map(encode).join("/")}`;
  const signedHeaderNames = input.contentType ? "content-type;host" : "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(Math.max(1, Math.min(input.expiresIn, 604800))),
    "X-Amz-SignedHeaders": signedHeaderNames,
  });
  const canonicalQuery = [...query.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encode(k)}=${encode(v)}`).join("&");
  const canonicalHeaders = `${input.contentType ? `content-type:${input.contentType.trim()}\n` : ""}host:${endpoint.host}\n`;
  const canonicalRequest = [input.method, path, canonicalQuery, canonicalHeaders, signedHeaderNames, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, credentialScope, sha256(canonicalRequest)].join("\n");
  const signature = crypto.createHmac("sha256", signingKey(config.secretAccessKey, day)).update(stringToSign).digest("hex");
  return `${endpoint.origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function headR2Object(objectKey: string) {
  const url = createR2PresignedUrl({ method: "HEAD", objectKey, expiresIn: 120 });
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error(`R2 HEAD failed: ${response.status}`);
  return {
    size: Number(response.headers.get("content-length") || 0),
    etag: response.headers.get("etag"),
    contentType: response.headers.get("content-type"),
  };
}

export async function deleteR2Object(objectKey: string) {
  const url = createR2PresignedUrl({ method: "DELETE", objectKey, expiresIn: 120 });
  const response = await fetch(url, { method: "DELETE", cache: "no-store" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 DELETE failed: ${response.status}`);
}

export function buildSocialObjectKey(kind: "images" | "clips" | "covers" | "frames" | "temporary", id: string, fileName: string) {
  const now = new Date();
  const safe = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `social/${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}/${safe}`;
}
