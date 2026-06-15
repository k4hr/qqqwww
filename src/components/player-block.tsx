import { Play } from "lucide-react";
import type { Movie } from "@prisma/client";

type Props = {
  movie: Pick<Movie, "titleRu" | "year" | "allohaId" | "trailerUrl">;
};

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const videoId = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.replace("/", "")
      : parsed.searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function PlayerBlock({ movie }: Props) {
  const allohaEnabled = process.env.ALLOHA_ENABLED === "true";
  const trailerEmbed = movie.trailerUrl ? youtubeEmbedUrl(movie.trailerUrl) : null;

  return (
    <section className="mf-panel mt-6 overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[#27272f] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">Смотреть онлайн {movie.titleRu} ({movie.year})</h2>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#e50914]">Плеер / трейлер</span>
      </div>

      <div className="bg-black text-white">
        {allohaEnabled && movie.allohaId ? (
          <iframe
            src={`https://example-player-domain.test/${movie.allohaId}`}
            className="aspect-video w-full border-0"
            allowFullScreen
            title={movie.titleRu}
          />
        ) : trailerEmbed ? (
          <iframe
            src={trailerEmbed}
            className="aspect-video w-full border-0"
            allowFullScreen
            title={`Трейлер ${movie.titleRu}`}
          />
        ) : (
          <div className="poster-fallback relative flex aspect-video flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,.2),transparent_45%)]" />
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#e50914] shadow-[0_0_40px_rgba(229,9,20,.35)]">
              <Play fill="white" color="white" size={28} />
            </div>
            <p className="relative z-10 mt-5 px-5 text-center text-sm text-white/60">Видео пока недоступно.</p>
          </div>
        )}
      </div>
    </section>
  );
}
