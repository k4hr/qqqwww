import { NextResponse } from "next/server";
import { createVibixFullSyncJob, type VibixJobContentType } from "@/lib/vibix-sync-job";
import type { VibixCatalogType } from "@/lib/vibix";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.VIBIX_API_KEY?.trim()) return NextResponse.json({ error: "VIBIX_API_KEY is not configured" }, { status: 500 });
  let contentType: VibixJobContentType = "both";
  let forceRestart = false;
  let resumeFromExisting = false;
  let startType: VibixCatalogType | undefined;
  let startPage: number | undefined;
  try {
    const body = await request.json() as {
      contentType?: string;
      forceRestart?: boolean;
      resumeFromExisting?: boolean;
      startType?: string;
      startPage?: number;
    };
    if (["movie", "serial", "both"].includes(body.contentType ?? "")) contentType = body.contentType as VibixJobContentType;
    if (body.startType === "movie" || body.startType === "serial") startType = body.startType;
    if (Number.isFinite(Number(body.startPage))) startPage = Number(body.startPage);
    forceRestart = body.forceRestart === true;
    resumeFromExisting = body.resumeFromExisting === true;
  } catch {
    // The default covers an empty request body.
  }
  const result = await createVibixFullSyncJob({
    contentType,
    limit: 20,
    pageDelayMs: 10_000,
    detailDelayMs: 2_000,
    forceRestart,
    resumeFromExisting,
    startType,
    startPage,
  });
  const message = result.created
    ? resumeFromExisting
      ? "Задача создана с продолжением по уже импортированной базе"
      : "Новая задача полной синхронизации создана"
    : "Найдена незавершённая задача. Продолжи, переставь страницу, пропусти проблемную страницу или отмени её перед новым стартом.";
  return NextResponse.json({ jobId: result.job.id, created: result.created, reused: result.reused, message, job: result.job }, { status: result.created ? 201 : 200 });
}
