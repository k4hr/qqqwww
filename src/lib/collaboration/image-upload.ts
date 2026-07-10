import "server-only";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function readImageDataUrl(formData: FormData, field: string, existing?: string | null) {
  if (formData.get(`${field}Remove`) === "on") return null;
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return existing ?? null;
  if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) return existing ?? null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
