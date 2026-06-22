import { NextResponse } from "next/server";
import { cancelActiveSimilarityJob, getSimilarityJobSnapshot } from "@/lib/similarity/similarity-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await cancelActiveSimilarityJob();
  const snapshot = await getSimilarityJobSnapshot();
  return NextResponse.json({ ok: true, result, snapshot });
}
