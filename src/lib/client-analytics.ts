export type AnalyticsEventType =
  | "page_view"
  | "card_click"
  | "watch_click"
  | "player_view"
  | "similar_click"
  | "search"
  | "discovery_submit"
  | "discovery_result_click"
  | "match_like"
  | "match_dislike"
  | "match_skip"
  | "match_undo"
  | "match_watch"
  | "match_favorite"
  | "match_reset"
  | "search_overlay_open"
  | "search_suggestion_click"
  | "favorite_toggle"
  | "ai_pick_opened"
  | "ai_pick_intent_submitted"
  | "pwa_install_clicked"
  | "pwa_ios_help_opened"
  | "ai_pick_batch_generated"
  | "ai_pick_fallback_used"
  | "ai_pick_like"
  | "ai_pick_dislike"
  | "ai_pick_skip"
  | "ai_pick_watch"
  | "ai_pick_restart"
  | "ai_pick_completed"
  | "ai_pick_failed"
  | "ai_pick_movie_opened"
  | "pwa_install_card_shown"
  | "pwa_install_accepted"
  | "pwa_install_dismissed"
  | "pwa_app_opened";

type EventPayload = {
  movieId?: string;
  path?: string;
  query?: string;
  referrer?: string;
  results?: number;
  count?: number;
  length?: number;
};

export function trackEvent(
  type: AnalyticsEventType,
  payload: EventPayload = {},
) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    type,
    movieId: payload.movieId,
    path: payload.path ?? window.location.pathname,
    query: payload.query,
    referrer: payload.referrer ?? document.referrer,
    results: payload.results,
    count: payload.count,
    length: payload.length,
  });

  try {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never interrupt navigation or playback.
  }
}

export const trackMovieView = (movieId: string) =>
  trackEvent("page_view", { movieId });

export const trackWatchClick = (movieId: string) =>
  trackEvent("watch_click", { movieId });

export const trackCardClick = (movieId: string) =>
  trackEvent("card_click", { movieId });

export const trackPlayerView = (movieId: string) =>
  trackEvent("player_view", { movieId });

export const trackSearch = (query: string, results: number) =>
  trackEvent("search", { query, results });



