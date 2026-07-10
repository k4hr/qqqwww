import { NextResponse } from "next/server";
import type { PartnerEventType } from "@prisma/client";
import { trackPartnerEvent } from "@/lib/collaboration/tracking";

const ALLOWED = new Set<PartnerEventType>(["AUTHOR_HUB_OPEN", "COLLECTION_OPEN", "MOVIE_OPEN", "PLAYER_START", "AD_VIEW", "AD_CLICK"]);

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = text(body.type, 40) as PartnerEventType;
  if (!ALLOWED.has(type)) return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  await trackPartnerEvent({
    request,
    type,
    partnerSlug: text(body.partnerSlug, 90) || null,
    collectionId: text(body.collectionId, 80) || null,
    movieId: text(body.movieId, 80) || null,
    source: text(body.source, 80) || null,
    metadata: { path: text(body.path, 300) || undefined },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
