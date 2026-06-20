import { NextResponse } from "next/server";
import { getLatestVibixSyncJob } from "@/lib/vibix-sync-job";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ job: await getLatestVibixSyncJob() });
}
