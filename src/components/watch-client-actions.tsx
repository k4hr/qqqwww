"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { addRecentlyWatched, isFavorite, toggleFavorite, type ClientMovieInput } from "@/lib/client-watch-history";

export function WatchClientActions({ movie }: { movie: ClientMovieInput }) {
  const [favorite, setFavorite] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    addRecentlyWatched(movie);
    setFavorite(isFavorite(movie.id));
    setReady(true);
  }, [movie]);

  return <button type="button" onClick={() => setFavorite(toggleFavorite(movie))} aria-pressed={favorite} className={`mf-btn mt-5 gap-2 ${favorite ? "active" : ""}`}>
    <Heart size={17} fill={favorite ? "currentColor" : "none"} /> {ready && favorite ? "В избранном" : "В избранное"}
  </button>;
}
