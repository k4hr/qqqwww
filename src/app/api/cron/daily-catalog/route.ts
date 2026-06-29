import { NextResponse } from "next/server";
import { startDailyCatalogPipelineJob, runVibixCatalogMagicJobIteration } from "@/lib/vibix-catalog/catalog-magic-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer === secret || url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const runOnce = url.searchParams.get("runOnce") !== "0";
  const job = await startDailyCatalogPipelineJob({ restart: true });
  const firstIteration = runOnce ? await runVibixCatalogMagicJobIteration({ force: true }) : null;

  return NextResponse.json({
    ok: true,
    message: "Daily catalog pipeline queued.",
    schedule: "06:00 Europe/Moscow",
    job,
    firstIteration,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
