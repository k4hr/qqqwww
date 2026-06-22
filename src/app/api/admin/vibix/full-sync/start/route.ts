import { NextResponse } from "next/server";
import { createVibixFullSyncJob, type VibixJobContentType } from "@/lib/vibix-sync-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.VIBIX_API_KEY?.trim()) return NextResponse.json({ error: "VIBIX_API_KEY is not configured" }, { status: 500 });
  let contentType: VibixJobContentType = "both";
  let forceRestart = false;
  try {
    const body = await request.json() as { contentType?: string; forceRestart?: boolean };
    if (["movie", "serial", "both"].includes(body.contentType ?? "")) contentType = body.contentType as VibixJobContentType;
    forceRestart = body.forceRestart === true;
  } catch {
    // The default covers an empty request body.
  }
  const result = await createVibixFullSyncJob({ contentType, limit: 20, pageDelayMs: 10_000, detailDelayMs: 2_000, forceRestart });
  const message = result.created
    ? "Новая задача полной синхронизации создана"
    : "Найдена незавершённая задача. Продолжи, пропусти проблемную страницу или отмени её перед новым стартом.";
  return NextResponse.json({ jobId: result.job.id, created: result.created, reused: result.reused, message, job: result.job }, { status: result.created ? 201 : 200 });
}
