import { NextResponse } from "next/server";
import { syncVibixVideos, VibixSyncAlreadyRunningError } from "@/lib/vibix-sync";

export const dynamic = "force-dynamic";

async function handleSync(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });

  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  if ((bearerSecret || querySecret) !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.VIBIX_API_KEY?.trim()) {
    return NextResponse.json({ error: "VIBIX_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const result = await syncVibixVideos({ mode: "all", limit: 100, maxPages: 10_000 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VibixSyncAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Vibix] Cron sync failed:", error);
    return NextResponse.json({ error: "Vibix sync failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
