import { Bookmark, MessageCircleWarning, Play, Share2 } from "lucide-react";
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
    <section className="mt-10">
      <div className="vip-panel overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#f0d79f]/85 mb-1">VIP Player Room</div>
            <h2 className="text-xl md:text-2xl font-black">Смотреть {movie.titleRu} ({movie.year})</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-white/70">
            <span className="vip-soft-panel px-4 py-2">Несколько плееров</span>
            <span className="vip-soft-panel px-4 py-2 text-[#baf1ce]">Комфортный просмотр</span>
          </div>
        </div>

        {allohaEnabled && movie.allohaId ? (
          <iframe
            src={`https://example-player-domain.test/${movie.allohaId}`}
            className="w-full aspect-video border-0 bg-black"
            allowFullScreen
            title={movie.titleRu}
          />
        ) : trailerEmbed ? (
          <iframe
            src={trailerEmbed}
            className="w-full aspect-video border-0 bg-black"
            allowFullScreen
            title={`Трейлер ${movie.titleRu}`}
          />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(201,168,106,.15),transparent_30%),linear-gradient(180deg,#05070d,#0b1020)] relative overflow-hidden px-6">
            <button className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] flex items-center justify-center hover:scale-105 transition-transform shadow-[0_18px_40px_rgba(201,168,106,.25)]" type="button">
              <Play fill="currentColor" size={34} />
            </button>
            <p className="relative z-10 mt-5 text-white/80 text-center max-w-xl">Премиальный плеер будет подключён после одобрения партнёрского доступа. Пока здесь можно показывать трейлер или демонстрационный видеоблок.</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-sm text-white/65">
          <div className="flex flex-wrap gap-2">
            <span className="vip-soft-panel px-4 py-2 inline-flex items-center gap-2"><MessageCircleWarning size={15} className="text-rose-300" /> Есть жалоба?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="vip-soft-panel px-4 py-2 inline-flex items-center gap-2"><Share2 size={15} /> Поделиться</span>
            <span className="vip-soft-panel px-4 py-2 inline-flex items-center gap-2"><Bookmark size={15} /> В закладки</span>
          </div>
        </div>
      </div>
    </section>
  );
}
