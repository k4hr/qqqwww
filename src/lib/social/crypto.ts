import crypto from "node:crypto";

function key() {
  const raw = process.env.SOCIAL_SECRET_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("SOCIAL_SECRET_ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, ivValue, tagValue, payload] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !payload) throw new Error("Unsupported encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
  return value.length <= 8 ? "••••" : `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}
