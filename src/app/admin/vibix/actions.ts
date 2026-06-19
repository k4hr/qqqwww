"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncVibixVideos } from "@/lib/vibix-sync";

function numberField(formData: FormData, name: string, fallback: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), max)) : fallback;
}

export async function syncVibixAction(formData: FormData) {
  const pages = numberField(formData, "pages", 5, 20);
  const limit = numberField(formData, "limit", 100, 100);
  const result = await syncVibixVideos({ pages, limit });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/vibix");
  redirect(`/admin/vibix?imported=${result.imported}&updated=${result.updated}&skipped=${result.skipped}&errors=${result.errors}`);
}
