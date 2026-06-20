"use client";

import { useEffect, useRef } from "react";
import { trackEvent, type AnalyticsEventType } from "@/lib/client-analytics";

export function AnalyticsEvent({ type, movieId, query, results }: { type: AnalyticsEventType; movieId?: string; query?: string; results?: number }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent(type, { movieId, query, results });
  }, [movieId, query, results, type]);
  return null;
}
