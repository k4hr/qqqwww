import type { Movie } from "@prisma/client";
import { VibixPlayer } from "@/components/vibix-player";
import { AnalyticsEvent } from "@/components/analytics-event";

type Props = {
  movie: Pick<Movie, "id" | "titleRu" | "year" | "kinopoiskId" | "imdbId" | "vibixId" | "vibixType" | "vibixIframeUrl" | "vibixEmbedCode" | "posterUrl">;
};

export function PlayerBlock({ movie }: Props) {
  return (
    <section className="rf-player-section mt-8">
      <div className="mb-3 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#e31b32]">REDFILM</div>
          <h2 className="mt-1 min-w-0 break-words text-[17px] font-semibold text-white">Смотреть {movie.titleRu}</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-[#74757d]">Если источник не загружается, отключите VPN или смените его сервер.</p>
      </div>

      <div className="rf-player-shell relative overflow-hidden rounded-[14px] bg-black text-white">
        <AnalyticsEvent type="player_view" movieId={movie.id} />
        <VibixPlayer
          movieId={movie.id}
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
