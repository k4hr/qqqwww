import { normalizeSlug } from "@/lib/seo-slugs";

const FORBIDDEN_EXACT = new Set([
  "actor",
  "actors",
  "actress",
  "director",
  "writer",
  "producer",
  "composer",
  "operator",
  "editor",
  "designer",
  "voice_actor",
  "voice actor",
  "озвучка",
  "актер",
  "актёр",
  "актриса",
  "режиссер",
  "режиссёр",
  "сценарист",
  "продюсер",
  "композитор",
  "оператор",
  "монтажер",
  "монтажёр",
  "дизайнер",
]);

const FORBIDDEN_ROLE = new Set([
  "producer",
  "voice_actor",
  "editor",
  "designer",
  "operator",
]);

function cleanPersonName(name: string | null | undefined) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPublicPersonName(name: string | null | undefined) {
  const value = cleanPersonName(name);
  if (!value) return false;
  const normalized = value.toLowerCase().replaceAll("ё", "е");
  if (value.length < 3 || value.length > 80) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^[a-z_]+$/i.test(value) && FORBIDDEN_EXACT.has(normalized)) return false;
  if (FORBIDDEN_EXACT.has(normalized)) return false;
  if (/\b(actor|producer|director|writer|voice_actor|designer|editor|operator)\b/i.test(value)) return false;
  if (!/[a-zа-яё]/i.test(value)) return false;
  if (normalizeSlug(value).length < 3) return false;
  return true;
}

export function isPublicPersonRole(role: string | null | undefined) {
  const value = String(role ?? "").trim().toLowerCase();
  if (!value) return true;
  return !FORBIDDEN_ROLE.has(value);
}

export function isPublicCastLink(input: { person?: { nameRu?: string | null } | null; role?: string | null }) {
  return isPublicPersonName(input.person?.nameRu) && isPublicPersonRole(input.role);
}

export function publicPersonTitle(name: string | null | undefined) {
  const value = cleanPersonName(name);
  return isPublicPersonName(value) ? value : null;
}
