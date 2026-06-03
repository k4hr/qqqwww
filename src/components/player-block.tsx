import { Play } from "lucide-react";
import type { Movie } from "@prisma/client";

type Props = {
  movie: Pick<Movie, "titleRu" | "year" | "allohaId" | "trailerUrl">;
};

export function PlayerBlock({ movie }: Props) {
  const allohaEnabled = process.env.ALLOHA_ENABLED === "true";

  return (
    <section className="mt-8 border-t border-mario-line pt-5">
      <h2 className="text-center text-xl font-medium mb-4">Смотреть онлайн {movie.titleRu} ({movie.year}) бесплатно</h2>
      <div className="bg-[#101010] text-white">
        <div className="h-12 flex items-center justify-between px-5 bg-[#1b1b1b] text-sm">
          <span><b>На выбор несколько плееров</b> <span className="text-mario-green ml-2">Приятного просмотра!</span></span>
          <span className="text-red-400">Есть жалоба?</span>
        </div>

        {allohaEnabled && movie.allohaId ? (
          <iframe
            src={`https://example-player-domain.test/${movie.allohaId}`}
            className="w-full aspect-video border-0"
            allowFullScreen
            title={movie.titleRu}
          />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center bg-black relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,#555,transparent_55%)]" />
            <button className="relative z-10 w-16 h-16 rounded-full bg-sky-500 flex items-center justify-center hover:scale-105 transition-transform">
              <Play fill="white" color="white" size={30} />
            </button>
            <p className="relative z-10 mt-5 text-white/80 text-center px-5">Плеер будет подключен после одобрения партнёрского доступа.</p>
          </div>
        )}

        <div className="h-11 bg-[#222] flex items-center justify-between px-5 text-sm text-white/70">
          <span>VK OK TG</span>
          <span>♡ Добавить в закладки</span>
        </div>
      </div>
    </section>
  );
}
