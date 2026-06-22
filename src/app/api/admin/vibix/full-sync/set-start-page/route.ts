import { NextResponse } from "next/server";
import { setVibixSyncJobStartPage, type VibixJobContentType } from "@/lib/vibix-sync-job";
import type { VibixCatalogType } from "@/lib/vibix";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as {
    jobId?: string;
    startType?: string;
    startPage?: number;
    contentType?: string;
    resumeFromExisting?: boolean;
  };
  if (!body.jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  const startType: VibixCatalogType | undefined = body.startType === "serial" || body.startType === "movie" ? body.startType : undefined;
  const contentType: VibixJobContentType | undefined = ["movie", "serial", "both"].includes(body.contentType ?? "") ? body.contentType as VibixJobContentType : undefined;
  const job = await setVibixSyncJobStartPage(body.jobId, {
    startType,
    startPage: body.startPage,
    contentType,
    resumeFromExisting: body.resumeFromExisting === true,
  });
  return NextResponse.json({ job });
}
