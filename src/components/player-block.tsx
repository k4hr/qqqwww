import { Play } from "lucide-react";
import type { Movie } from "@prisma/client";

type Props = {
  movie: Pick<Movie, "titleRu" | "year" | "vibixIframeUrl">;
};

export function PlayerBlock({ movie }: Props) {
  return (
    <section className="cinema-glow mf-panel mt-6 overflow-hidden">
      <div className="relative flex flex-col gap-2 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">Смотреть онлайн {movie.titleRu} ({movie.year})</h2>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#e50914]">Плеер Vibix</span>
      </div>

      <div className="relative bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e50914]/80 to-transparent" />
        {movie.vibixIframeUrl ? (
          <iframe
            src={movie.vibixIframeUrl}
            className="aspect-video w-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer-when-downgrade"
            title={movie.titleRu}
          />
        ) : (
          <div className="poster-fallback relative flex aspect-video flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,.24),transparent_45%),linear-gradient(180deg,rgba(255,255,255,.04),transparent)]" />
            <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/10 bg-[#e50914] shadow-[0_0_52px_rgba(229,9,20,.42)]">
              <Play fill="white" color="white" size={28} />
            </div>
            <p className="relative z-10 mt-5 px-5 text-center text-white/70">Плеер Vibix пока не найден</p>
          </div>
        )}
      </div>
    </section>
  );
}
