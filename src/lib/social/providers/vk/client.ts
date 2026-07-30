const VK_API_VERSION = process.env.VK_API_VERSION?.trim() || "5.199";
const VK_BASE = "https://api.vk.com/method";
let nextAllowedAt = 0;

export class VkApiError extends Error {
  constructor(public code: number, message: string, public details?: unknown) {
    super(message);
    this.name = "VkApiError";
  }
}

async function throttle() {
  const wait = Math.max(0, nextAllowedAt - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  nextAllowedAt = Date.now() + 360;
}

export async function vkCall<T>(
  method: string,
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  await throttle();
  const body = new URLSearchParams({ access_token: token, v: VK_API_VERSION });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, String(value));
  }

  const response = await fetch(`${VK_BASE}/${method}`, {
    method: "POST",
    body,
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`VK HTTP ${response.status}`);

  const json = (await response.json()) as {
    response?: T;
    error?: {
      error_code: number;
      error_msg: string;
      request_params?: unknown;
    };
  };

  if (json.error) {
    throw new VkApiError(
      json.error.error_code,
      json.error.error_msg,
      json.error.request_params,
    );
  }

  if (json.response === undefined) {
    throw new Error("VK returned an empty response");
  }

  return json.response;
}

type VkCommunityTokenPermissions = {
  mask: number;
  permissions?: Array<{ name: string; setting: number }>;
};

type VkGroup = {
  id: number;
  name: string;
  screen_name: string;
  photo_200?: string;
};

type VkGroupsGetByIdResponse =
  | VkGroup[]
  | {
      groups?: VkGroup[];
      profiles?: unknown[];
    };

function normalizeCommunityIdentifier(value: string) {
  let result = value.trim();

  try {
    if (/^https?:\/\//i.test(result)) {
      const url = new URL(result);
      result = url.pathname.split("/").filter(Boolean)[0] || result;
    }
  } catch {
    // If it is not a valid URL, continue with the entered identifier.
  }

  result = result.replace(/^@/, "");
  result = result.replace(/^(club|public)/i, "");
  return result.trim();
}

function extractGroups(response: VkGroupsGetByIdResponse): VkGroup[] {
  if (Array.isArray(response)) return response;
  return Array.isArray(response.groups) ? response.groups : [];
}

export async function validateVkConnection(token: string, groupId: string) {
  const normalizedGroupId = normalizeCommunityIdentifier(groupId);
  if (!normalizedGroupId) throw new Error("Укажите ID или короткое имя сообщества VK");

  const [groupResponse, tokenPermissions] = await Promise.all([
    vkCall<VkGroupsGetByIdResponse>("groups.getById", token, {
      group_id: normalizedGroupId,
      fields: "name,screen_name,photo_200",
    }),
    vkCall<VkCommunityTokenPermissions>("groups.getTokenPermissions", token),
  ]);

  const group = extractGroups(groupResponse)[0];
  if (!group) {
    throw new Error(
      `VK не вернул данные сообщества «${normalizedGroupId}». Проверьте короткое имя или числовой ID.`,
    );
  }

  const permissions = Number(tokenPermissions.mask || 0);
  return {
    group,
    permissions,
    capabilities: {
      wall: Boolean(permissions & 8192),
      photos: Boolean(permissions & 4),
      video: Boolean(permissions & 16),
    },
  };
}
