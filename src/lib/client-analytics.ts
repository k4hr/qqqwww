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
  | "favorite_toggle";

type EventPayload = { movieId?: string; path?: string; query?: string; referrer?: string; results?: number };

export function trackEvent(type: AnalyticsEventType, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    type,
    movieId: payload.movieId,
    path: payload.path ?? window.location.pathname,
    query: payload.query,
    referrer: payload.referrer ?? document.referrer,
    results: payload.results,
  });
  try {
    void fetch("/api/analytics/event", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // Analytics must never interrupt navigation or playback.
  }
}

export const trackMovieView = (movieId: string) => trackEvent("page_view", { movieId });
export const trackWatchClick = (movieId: string) => trackEvent("watch_click", { movieId });
export const trackCardClick = (movieId: string) => trackEvent("card_click", { movieId });
export const trackPlayerView = (movieId: string) => trackEvent("player_view", { movieId });
export const trackSearch = (query: string, results: number) => trackEvent("search", { query, results });
