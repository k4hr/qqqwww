import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Movie } from "@prisma/client";
import { ArtworkPlaceholder, isGenericRedfilmArtwork } from "@/components/artwork-placeholder";

type PromoMovie = Pick<Movie, "id" | "titleRu" | "posterUrl">;

export function HomeMatchPromo({ movies }: { movies: PromoMovie[] }) {
  const posters = movies.slice(0, 4);

  return (
    <section className="rf-section rf-match-promo overflow-hidden border-y border-white/[.055]">
      <div className="grid min-h-[250px] items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="relative z-10 max-w-xl">
          <div className="rf-section-eyebrow inline-flex items-center gap-2"><Sparkles size={13} /> REDFILM Match</div>
          <h2 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.08] tracking-[-.035em] text-white">Не знаете, что посмотреть?</h2>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-[#a0a1a8]">Отмечайте, что нравится, и REDFILM соберёт персональную очередь из доступного каталога.</p>
          <Link href="/match" className="mf-btn mf-btn-primary mt-6 gap-2">Открыть REDFILM Match <ArrowRight size={15} /></Link>
        </div>

        {posters.length ? (
          <div className="relative hidden h-[250px] lg:block" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(227,27,50,.11),transparent_62%)]" />
            {posters.map((movie, index) => {
              const positions = [
                "left-5 top-7 -rotate-6",
                "left-[120px] top-0 -rotate-2",
                "right-[92px] top-3 rotate-3",
                "right-0 top-9 rotate-6",
              ];
              return (
                <div key={movie.id} className={`absolute aspect-[2/3] w-[132px] overflow-hidden rounded-[12px] border border-white/[.06] bg-[#0e0f12] shadow-[0_16px_40px_rgba(0,0,0,.28)] ${positions[index]}`}>
                  {!isGenericRedfilmArtwork(movie.posterUrl)
                    ? <Image src={movie.posterUrl!} alt="" fill sizes="132px" className="object-cover" />
                    : <ArtworkPlaceholder title={movie.titleRu} compact />}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
