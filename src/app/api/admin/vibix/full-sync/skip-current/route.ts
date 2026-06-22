import { NextResponse } from "next/server";
import { skipCurrentVibixSyncJob } from "@/lib/vibix-sync-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { jobId } = await request.json() as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  return NextResponse.json({ job: await skipCurrentVibixSyncJob(jobId) });
}
