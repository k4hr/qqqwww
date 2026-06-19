import type { Movie } from "@prisma/client";
import { VibixPlayer } from "@/components/vibix-player";

type Props = {
  movie: Pick<Movie, "titleRu" | "year" | "kinopoiskId" | "imdbId" | "vibixIframeUrl" | "vibixEmbedCode" | "posterUrl">;
};

export function PlayerBlock({ movie }: Props) {
  return (
    <section className="cinema-glow mf-panel mt-6 overflow-hidden">
      <div className="relative flex flex-col gap-2 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">Смотреть онлайн {movie.titleRu} ({movie.year})</h2>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#e50914]">REDFILM</span>
      </div>

      <div className="relative bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e50914]/80 to-transparent" />
        <VibixPlayer
          title={movie.titleRu}
          kinopoiskId={movie.kinopoiskId}
          imdbId={movie.imdbId}
          embedCode={movie.vibixEmbedCode}
          iframeUrl={movie.vibixIframeUrl}
          posterUrl={movie.posterUrl}
        />
      </div>
    </section>
  );
}
