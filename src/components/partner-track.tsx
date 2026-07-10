"use client";

import { useEffect, useRef } from "react";

type PartnerTrackType = "AUTHOR_HUB_OPEN" | "COLLECTION_OPEN" | "MOVIE_OPEN" | "PLAYER_START" | "AD_VIEW" | "AD_CLICK";

export function PartnerTrack({ type, partnerSlug, collectionId, movieId, source }: { type: PartnerTrackType; partnerSlug?: string; collectionId?: string; movieId?: string; source?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    try {
      void fetch("/api/partner/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, partnerSlug, collectionId, movieId, source, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Partner analytics must never interrupt public pages.
    }
  }, [collectionId, movieId, partnerSlug, source, type]);
  return null;
}

export function trackPartnerPlayerStart(movieId?: string | null) {
  if (!movieId || typeof window === "undefined") return;
  try {
    void fetch("/api/partner/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "PLAYER_START", movieId, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Playback must never be blocked by partner analytics.
  }
}
