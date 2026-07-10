"use client";

import { useState, useTransition } from "react";
import { partnerAddMovie } from "@/app/partner/actions";
import { partnerButton, partnerInput } from "@/app/partner/_components";

type SearchMovie = {
  id: string;
  titleRu: string;
  year: number;
  type: string;
  posterUrl: string | null;
  kpRating: number | null;
  imdbRating: number | null;
};

export function PartnerCatalogSearch({ collectionId }: { collectionId: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [movies, setMovies] = useState<SearchMovie[]>([]);
  const [isPending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const params = new URLSearchParams({ q: query });
      if (type) params.set("type", type);
      const response = await fetch(`/api/partner/catalog/search?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      setMovies(Array.isArray(json.movies) ? json.movies : []);
    });
  }

  return (
    <section className="mf-panel p-5">
      <h2 className="text-xl font-black text-white">Каталог REDFILM</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className={partnerInput} placeholder="Название фильма или сериала" />
        <select value={type} onChange={(event) => setType(event.target.value)} className={partnerInput}>
          <option value="">Все типы</option>
          <option value="MOVIE">Фильмы</option>
          <option value="SERIES">Сериалы</option>
          <option value="CARTOON">Мультфильмы</option>
          <option value="ANIME">Аниме</option>
        </select>
        <button type="button" onClick={search} className={partnerButton}>{isPending ? "Ищу..." : "Найти"}</button>
      </div>
      <div className="mt-4 grid gap-3">
        {movies.map((movie) => (
          <form key={movie.id} action={partnerAddMovie} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,360px)_auto] md:items-center">
            <input type="hidden" name="collectionId" value={collectionId} />
            <input type="hidden" name="movieId" value={movie.id} />
            <div>
              <div className="font-black text-white">{movie.titleRu}</div>
              <div className="text-sm text-[#a1a1aa]">{movie.year} · {movie.type} · КП {movie.kpRating ?? "—"} · IMDb {movie.imdbRating ?? "—"}</div>
            </div>
            <input name="authorComment" className={partnerInput} placeholder="Почему советую..." />
            <button className={partnerButton}>Добавить</button>
          </form>
        ))}
      </div>
    </section>
  );
}
