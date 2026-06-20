import { NextResponse } from "next/server";
import { createVibixFullSyncJob, type VibixJobContentType } from "@/lib/vibix-sync-job";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.VIBIX_API_KEY?.trim()) return NextResponse.json({ error: "VIBIX_API_KEY is not configured" }, { status: 500 });
  let contentType: VibixJobContentType = "both";
  try {
    const body = await request.json() as { contentType?: string };
    if (["movie", "serial", "both"].includes(body.contentType ?? "")) contentType = body.contentType as VibixJobContentType;
  } catch {
    // The default covers an empty request body.
  }
  const result = await createVibixFullSyncJob({ contentType, limit: 20, pageDelayMs: 10_000, detailDelayMs: 2_000 });
  return NextResponse.json({ jobId: result.job.id, created: result.created, message: result.created ? "Задача запущена" : "Синхронизация уже идёт", job: result.job }, { status: result.created ? 201 : 200 });
}
