import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set([
  "page_view",
  "card_click",
  "watch_click",
  "player_view",
  "similar_click",
  "search",
  "discovery_submit",
  "discovery_result_click",
  "match_like",
  "match_dislike",
  "match_skip",
  "match_undo",
  "match_watch",
  "match_favorite",
  "match_reset",
  "search_overlay_open",
  "search_suggestion_click",
  "favorite_toggle",
  "ai_pick_opened",
  "ai_pick_intent_submitted",
  "ai_pick_batch_generated",
  "ai_pick_fallback_used",
  "ai_pick_like",
  "ai_pick_dislike",
  "ai_pick_skip",
  "ai_pick_watch",
  "ai_pick_restart",
  "ai_pick_completed",
  "ai_pick_failed",
  "ai_pick_movie_opened",
  "pwa_install_clicked",
  "pwa_ios_help_opened",
  "pwa_install_card_shown",
  "pwa_install_accepted",
  "pwa_install_dismissed",
  "pwa_app_opened",
]);

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
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
  const type = shortText(body.type, 32);
  if (!type || !ALLOWED_TYPES.has(type)) return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  const movieId = shortText(body.movieId, 64);
  const query = shortText(body.query, 160);
  const results = Math.max(0, Math.min(10_000, Number(body.results) || 0));

  try {
    const movieEvent = prisma.movieEvent.create({
      data: {
        type,
        movieId,
        path: shortText(body.path, 300),
        referrer: shortText(body.referrer, 500),
        query,
        userAgent: shortText(request.headers.get("user-agent"), 300),
      },
    });
    if (type === "search" && query) {
      await prisma.$transaction([movieEvent, prisma.searchEvent.create({ data: { query, results } })]);
    } else {
      await movieEvent;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Analytics storage is not ready" }, { status: 503 });
  }
}
