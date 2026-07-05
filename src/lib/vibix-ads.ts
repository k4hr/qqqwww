import { Prisma, type VibixAdSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const VIBIX_AD_TYPES = ["sticker", "pcsticker", "banners", "brand", "flyroll"] as const;
export type VibixAdType = typeof VIBIX_AD_TYPES[number];

export const VIBIX_BANNER_SIZES = ["300x250", "300x600", "680x200", "680x250", "728x90"] as const;
export type VibixBannerSize = typeof VIBIX_BANNER_SIZES[number];

export const VIBIX_FLYROLL_POSITIONS = [
  { value: 1, label: "1 — право сверху" },
  { value: 2, label: "2 — право снизу" },
  { value: 3, label: "3 — лево снизу" },
  { value: 4, label: "4 — лево сверху" },
] as const;

export const VIBIX_FLYROLL_SLOTS = [
  { value: "auto", label: "Автоматически: фиксируется сам" },
  { value: "movie_above_player", label: "Страница фильма: над плеером" },
  { value: "movie_below_player", label: "Страница фильма: под плеером" },
] as const;

export type VibixBannerSlotKey =
  | "home_after_popular"
  | "movie_above_player"
  | "movie_below_player"
  | "movie_bottom"
  | "catalog_after_12";

export type VibixBannerSlotConfig = {
  title: string;
  description: string;
  size: VibixBannerSize;
  enabled: boolean;
  desktop: boolean;
  mobile: boolean;
};

export const VIBIX_BANNER_SLOT_DEFINITIONS: Array<{ key: VibixBannerSlotKey; title: string; description: string; defaultSize: VibixBannerSize; defaultEnabled: boolean; defaultDesktop: boolean; defaultMobile: boolean }> = [
  {
    key: "home_after_popular",
    title: "Главная — между блоками",
    description: "Баннер на главной странице между подборками. Сейчас в проекте стоял 728x90.",
    defaultSize: "728x90",
    defaultEnabled: true,
    defaultDesktop: true,
    defaultMobile: false,
  },
  {
    key: "movie_above_player",
    title: "Страница фильма — над плеером",
    description: "Аккуратный баннер перед плеером. Выключен по умолчанию, чтобы не мешать первому запуску фильма.",
    defaultSize: "728x90",
    defaultEnabled: false,
    defaultDesktop: true,
    defaultMobile: false,
  },
  {
    key: "movie_below_player",
    title: "Страница фильма — под плеером",
    description: "Баннер сразу после плеера. Хороший безопасный слот для 680x250 или 680x200.",
    defaultSize: "680x250",
    defaultEnabled: false,
    defaultDesktop: true,
    defaultMobile: false,
  },
  {
    key: "movie_bottom",
    title: "Страница фильма — нижний баннер",
    description: "Баннер ниже похожих фильмов. Сейчас в проекте стоял 680x200.",
    defaultSize: "680x200",
    defaultEnabled: true,
    defaultDesktop: true,
    defaultMobile: false,
  },
  {
    key: "catalog_after_12",
    title: "Каталог — после карточек",
    description: "Зарезервированный слот для каталогов. Включать после отдельной врезки в catalog grid.",
    defaultSize: "300x250",
    defaultEnabled: false,
    defaultDesktop: true,
    defaultMobile: true,
  },
];

export type VibixAdSettingsView = {
  enabled: boolean;
  publisherId: string;
  scriptUrl: string;
  stickerEnabled: boolean;
  pcStickerEnabled: boolean;
  bannersEnabled: boolean;
  brandEnabled: boolean;
  flyrollEnabled: boolean;
  flyrollPosition: 1 | 2 | 3 | 4;
  flyrollManualSlot: string;
  bannerSlots: Record<VibixBannerSlotKey, VibixBannerSlotConfig>;
};

function envPublisherId() {
  return process.env.VIBIX_PUBLISHER_ID?.trim() || "678353780";
}

function envScriptUrl() {
  return "https://v-js-menu.run/public/lib.en.min.js";
}

function parseEnvAdTypes() {
  const raw = process.env.NEXT_PUBLIC_VIBIX_AD_TYPES?.trim() || "sticker,pcsticker,banners,flyroll";
  return new Set(raw.split(",").map((type) => type.trim()).filter(Boolean));
}

export function defaultVibixBannerSlots(): Record<VibixBannerSlotKey, VibixBannerSlotConfig> {
  return Object.fromEntries(
    VIBIX_BANNER_SLOT_DEFINITIONS.map((slot) => [
      slot.key,
      {
        title: slot.title,
        description: slot.description,
        size: slot.defaultSize,
        enabled: slot.defaultEnabled,
        desktop: slot.defaultDesktop,
        mobile: slot.defaultMobile,
      },
    ]),
  ) as Record<VibixBannerSlotKey, VibixBannerSlotConfig>;
}

function isBannerSize(value: unknown): value is VibixBannerSize {
  return typeof value === "string" && (VIBIX_BANNER_SIZES as readonly string[]).includes(value);
}

function normalizeBannerSlots(value: unknown): Record<VibixBannerSlotKey, VibixBannerSlotConfig> {
  const defaults = defaultVibixBannerSlots();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const input = value as Record<string, unknown>;

  for (const definition of VIBIX_BANNER_SLOT_DEFINITIONS) {
    const raw = input[definition.key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const slot = raw as Record<string, unknown>;
    defaults[definition.key] = {
      ...defaults[definition.key],
      size: isBannerSize(slot.size) ? slot.size : defaults[definition.key].size,
      enabled: typeof slot.enabled === "boolean" ? slot.enabled : defaults[definition.key].enabled,
      desktop: typeof slot.desktop === "boolean" ? slot.desktop : defaults[definition.key].desktop,
      mobile: typeof slot.mobile === "boolean" ? slot.mobile : defaults[definition.key].mobile,
    };
  }

  return defaults;
}

function normalizePosition(value: number): 1 | 2 | 3 | 4 {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return 2;
}

function toView(settings: VibixAdSettings | null | undefined): VibixAdSettingsView {
  if (!settings) {
    const envTypes = parseEnvAdTypes();
    return {
      enabled: true,
      publisherId: envPublisherId(),
      scriptUrl: envScriptUrl(),
      stickerEnabled: envTypes.has("sticker"),
      pcStickerEnabled: envTypes.has("pcsticker"),
      bannersEnabled: envTypes.has("banners"),
      brandEnabled: envTypes.has("brand"),
      flyrollEnabled: envTypes.has("flyroll"),
      flyrollPosition: 2,
      flyrollManualSlot: "auto",
      bannerSlots: defaultVibixBannerSlots(),
    };
  }

  return {
    enabled: settings.enabled,
    publisherId: settings.publisherId?.trim() || envPublisherId(),
    scriptUrl: settings.scriptUrl?.trim() || envScriptUrl(),
    stickerEnabled: settings.stickerEnabled,
    pcStickerEnabled: settings.pcStickerEnabled,
    bannersEnabled: settings.bannersEnabled,
    brandEnabled: settings.brandEnabled,
    flyrollEnabled: settings.flyrollEnabled,
    flyrollPosition: normalizePosition(settings.flyrollPosition),
    flyrollManualSlot: settings.flyrollManualSlot || "auto",
    bannerSlots: normalizeBannerSlots(settings.bannerSlotsJson),
  };
}

let cachedAdSettings: { expiresAt: number; value: VibixAdSettingsView } | null = null;

export async function getVibixAdSettings(): Promise<VibixAdSettingsView> {
  const now = Date.now();
  if (cachedAdSettings && cachedAdSettings.expiresAt > now) return cachedAdSettings.value;

  try {
    const settings = await prisma.vibixAdSettings.findUnique({ where: { singletonKey: "default" } });
    const value = toView(settings);
    cachedAdSettings = { value, expiresAt: now + 120_000 };
    return value;
  } catch (error) {
    console.error("[VibixAds] Failed to read ad settings:", error);
    const fallback = cachedAdSettings?.value ?? toView(null);
    cachedAdSettings = { value: fallback, expiresAt: now + 30_000 };
    return fallback;
  }
}

export async function ensureVibixAdSettings() {
  const defaults = toView(null);
  return prisma.vibixAdSettings.upsert({
    where: { singletonKey: "default" },
    update: {},
    create: {
      singletonKey: "default",
      enabled: defaults.enabled,
      publisherId: defaults.publisherId,
      scriptUrl: defaults.scriptUrl,
      stickerEnabled: defaults.stickerEnabled,
      pcStickerEnabled: defaults.pcStickerEnabled,
      bannersEnabled: defaults.bannersEnabled,
      brandEnabled: defaults.brandEnabled,
      flyrollEnabled: defaults.flyrollEnabled,
      flyrollPosition: defaults.flyrollPosition,
      flyrollManualSlot: defaults.flyrollManualSlot,
      bannerSlotsJson: defaults.bannerSlots as unknown as Prisma.InputJsonValue,
    },
  });
}

export function getEnabledVibixAdTypes(settings: VibixAdSettingsView) {
  const types: VibixAdType[] = [];
  if (!settings.enabled) return types;
  if (settings.stickerEnabled) types.push("sticker");
  if (settings.pcStickerEnabled) types.push("pcsticker");
  if (settings.bannersEnabled) types.push("banners");
  if (settings.brandEnabled) types.push("brand");
  if (settings.flyrollEnabled) types.push("flyroll");
  return types;
}

export function getVibixAddTypesAttribute(settings: VibixAdSettingsView) {
  return getEnabledVibixAdTypes(settings).join(",");
}

export function getVibixBannerSlot(settings: VibixAdSettingsView, key: VibixBannerSlotKey) {
  return settings.bannerSlots[key] || defaultVibixBannerSlots()[key];
}
