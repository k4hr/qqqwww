import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "redfilm",
    now: new Date().toISOString(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    publicPlaybackEnabled: process.env.PUBLIC_PLAYBACK_ENABLED !== "false",
    publicIndexingEnabled: process.env.PUBLIC_INDEXING_ENABLED !== "false",
    emergencyDeindexMode: process.env.EMERGENCY_DEINDEX_MODE === "true",
  });
}
