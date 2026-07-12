"use client";

import { useEffect } from "react";
import { trackEvent, type AnalyticsEventType } from "@/lib/client-analytics";

const ALLOWED_EVENTS = new Set<AnalyticsEventType>(["card_click", "watch_click", "similar_click"]);

export function AnalyticsClickBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-event]")
        : null;
      if (!target) return;

      const type = target.dataset.analyticsEvent as AnalyticsEventType | undefined;
      if (!type || !ALLOWED_EVENTS.has(type)) return;

      trackEvent(type, { movieId: target.dataset.analyticsMovieId });
    };

    document.addEventListener("click", handleClick, { passive: true, capture: true });
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
