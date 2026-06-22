"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  VIBIX_BANNER_SLOT_DEFINITIONS,
  VIBIX_BANNER_SIZES,
  VIBIX_FLYROLL_SLOTS,
  defaultVibixBannerSlots,
  ensureVibixAdSettings,
  type VibixBannerSize,
} from "@/lib/vibix-ads";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function numberField(formData: FormData, key: string, fallback: number, allowed: number[]) {
  const value = Number(text(formData, key));
  return allowed.includes(value) ? value : fallback;
}

function bannerSize(value: string, fallback: VibixBannerSize): VibixBannerSize {
  return (VIBIX_BANNER_SIZES as readonly string[]).includes(value) ? value as VibixBannerSize : fallback;
}

function flyrollSlot(value: string) {
  return VIBIX_FLYROLL_SLOTS.some((slot) => slot.value === value) ? value : "auto";
}

export async function saveVibixAdSettings(formData: FormData) {
  await ensureVibixAdSettings();
  const defaults = defaultVibixBannerSlots();
  const bannerSlots = { ...defaults };

  for (const definition of VIBIX_BANNER_SLOT_DEFINITIONS) {
    const key = definition.key;
    bannerSlots[key] = {
      ...defaults[key],
      enabled: checkbox(formData, `${key}_enabled`),
      desktop: checkbox(formData, `${key}_desktop`),
      mobile: checkbox(formData, `${key}_mobile`),
      size: bannerSize(text(formData, `${key}_size`), defaults[key].size),
    };
  }

  const publisherId = text(formData, "publisherId") || process.env.VIBIX_PUBLISHER_ID?.trim() || "678353780";
  const scriptUrl = text(formData, "scriptUrl") || "https://v-js-menu.run/public/lib.en.min.js";

  await prisma.vibixAdSettings.upsert({
    where: { singletonKey: "default" },
    update: {
      enabled: checkbox(formData, "enabled"),
      publisherId,
      scriptUrl,
      stickerEnabled: checkbox(formData, "stickerEnabled"),
      pcStickerEnabled: checkbox(formData, "pcStickerEnabled"),
      bannersEnabled: checkbox(formData, "bannersEnabled"),
      brandEnabled: checkbox(formData, "brandEnabled"),
      flyrollEnabled: checkbox(formData, "flyrollEnabled"),
      flyrollPosition: numberField(formData, "flyrollPosition", 2, [1, 2, 3, 4]),
      flyrollManualSlot: flyrollSlot(text(formData, "flyrollManualSlot")),
      bannerSlotsJson: bannerSlots as unknown as Prisma.InputJsonValue,
    },
    create: {
      singletonKey: "default",
      enabled: checkbox(formData, "enabled"),
      publisherId,
      scriptUrl,
      stickerEnabled: checkbox(formData, "stickerEnabled"),
      pcStickerEnabled: checkbox(formData, "pcStickerEnabled"),
      bannersEnabled: checkbox(formData, "bannersEnabled"),
      brandEnabled: checkbox(formData, "brandEnabled"),
      flyrollEnabled: checkbox(formData, "flyrollEnabled"),
      flyrollPosition: numberField(formData, "flyrollPosition", 2, [1, 2, 3, 4]),
      flyrollManualSlot: flyrollSlot(text(formData, "flyrollManualSlot")),
      bannerSlotsJson: bannerSlots as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/ads");
  revalidatePath("/");
  redirect("/admin/ads?saved=1");
}

export async function disableAllVibixAds() {
  await ensureVibixAdSettings();
  await prisma.vibixAdSettings.update({
    where: { singletonKey: "default" },
    data: {
      enabled: false,
      stickerEnabled: false,
      pcStickerEnabled: false,
      bannersEnabled: false,
      brandEnabled: false,
      flyrollEnabled: false,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/ads");
  redirect("/admin/ads?disabled=1");
}
