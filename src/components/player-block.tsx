import type { Movie } from "@prisma/client";
import { VibixPlayer } from "@/components/vibix-player";
import { AnalyticsEvent } from "@/components/analytics-event";

type Props = {
  movie: Pick<Movie, "id" | "titleRu" | "year" | "kinopoiskId" | "imdbId" | "vibixId" | "vibixType" | "vibixIframeUrl" | "vibixEmbedCode" | "posterUrl">;
};

export function PlayerBlock({ movie }: Props) {
  return (
    <section className="cinema-glow mf-panel mt-6 overflow-hidden">
      <div className="relative flex min-w-0 flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 className="min-w-0 break-words text-base font-bold text-white sm:text-lg">Смотреть онлайн {movie.titleRu} ({movie.year})</h2>
        <div className="shrink-0 text-left sm:text-right">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#e50914] sm:text-xs">REDFILM</span>
          <span className="mt-1 block text-[11px] font-semibold leading-snug text-white sm:text-xs">Не работает плеер? Придется отключить VPN.</span>
        </div>
      </div>

      <div className="relative bg-black text-white">
        <AnalyticsEvent type="player_view" movieId={movie.id} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e50914]/80 to-transparent" />
        <VibixPlayer
          title={movie.titleRu}
          kinopoiskId={movie.kinopoiskId}
          imdbId={movie.imdbId}
          vibixId={movie.vibixId}
          vibixType={movie.vibixType}
          embedCode={movie.vibixEmbedCode}
          iframeUrl={movie.vibixIframeUrl}
          posterUrl={movie.posterUrl}
        />
      </div>
    </section>
  );
}
