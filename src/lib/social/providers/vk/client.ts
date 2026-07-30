const VK_API_VERSION = process.env.VK_API_VERSION?.trim() || "5.199";
const VK_BASE = "https://api.vk.com/method";
let nextAllowedAt = 0;

export class VkApiError extends Error {
  constructor(public code: number, message: string, public details?: unknown) { super(message); }
}

async function throttle() {
  const wait = Math.max(0, nextAllowedAt - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  nextAllowedAt = Date.now() + 360;
}

export async function vkCall<T>(method: string, token: string, params: Record<string, string | number | boolean | undefined> = {}) {
  await throttle();
  const body = new URLSearchParams({ access_token: token, v: VK_API_VERSION });
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value));
  const response = await fetch(`${VK_BASE}/${method}`, { method: "POST", body, cache: "no-store" });
  if (!response.ok) throw new Error(`VK HTTP ${response.status}`);
  const json = await response.json() as { response?: T; error?: { error_code: number; error_msg: string; request_params?: unknown } };
  if (json.error) throw new VkApiError(json.error.error_code, json.error.error_msg, json.error.request_params);
  if (json.response === undefined) throw new Error("VK returned an empty response");
  return json.response;
}

export async function validateVkConnection(token: string, groupId: string) {
  const [groups, permissions] = await Promise.all([
    vkCall<Array<{ id: number; name: string; screen_name: string; photo_200?: string }>>("groups.getById", token, { group_id: groupId, fields: "name,screen_name,photo_200" }),
    vkCall<number>("account.getAppPermissions", token),
  ]);
  const group = groups[0];
  if (!group) throw new Error("VK community was not found");
  return { group, permissions, capabilities: { wall: Boolean(permissions & 8192), photos: Boolean(permissions & 4), video: Boolean(permissions & 16) } };
}
