import "server-only";

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

const PASSWORD_PREFIX = "scrypt";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${PASSWORD_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split(":");
  if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashNullable(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? sha256(normalized) : null;
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function readText(formData: FormData, key: string, max = 500) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readBool(formData: FormData, key: string, fallback = false) {
  const value = formData.get(key);
  if (value == null) return fallback;
  return value === "on" || value === "true" || value === "1";
}
