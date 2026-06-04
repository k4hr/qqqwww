import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { ContentType } from "@prisma/client";
import { ArrowRight, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [movies, series, cartoons, anime, genres] = await Promise.all([
    prisma.movie.findMany({ where: { type: ContentType.MOVIE, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.SERIES, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.CARTOON, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.ANIME, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 18 }),
  ]);

  return (
    <div className="container py-6 md:py-8">
      <section className="vip-panel hero-backdrop grid-fade p-6 md:p-8 lg:p-10 mb-10 overflow-hidden">
        <div className="max-w-4xl relative z-10">
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/movies?year=2026" className="rounded-full border border-[#c9a86a]/20 bg-white/[0.04] px-5 py-3 text-white/80 hover:border-[#c9a86a]/35 hover:text-white transition">★ Фильмы 2026</Link>
            <Link href="/series?year=2026" className="rounded-full border border-[#c9a86a]/20 bg-white/[0.04] px-5 py-3 text-white/80 hover:border-[#c9a86a]/35 hover:text-white transition">Сериалы 2026</Link>
            <Link href="/top" className="rounded-full border border-[#c9a86a]/20 bg-white/[0.04] px-5 py-3 text-white/80 hover:border-[#c9a86a]/35 hover:text-white transition">ТОП100 в этом месяце</Link>
            <Link href="/latest" className="rounded-full border border-[#c9a86a]/20 bg-white/[0.04] px-5 py-3 text-white/80 hover:border-[#c9a86a]/35 hover:text-white transition">Последние обновления</Link>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.02]">
            MARIOFILM — фильмы смотреть онлайн
          </h1>
          <p className="text-white/70 text-lg md:text-xl mt-5 max-w-3xl leading-relaxed">
            Каталог фильмов, сериалов, мультфильмов и аниме. На старте сайт работает как база карточек с описаниями, рейтингами, трейлерами и подборками. Плеер подключается отдельным модулем после одобрения партнёрского доступа.
          </p>

          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="/movies" className="rounded-full px-6 py-3.5 bg-gradient-to-r from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] font-bold hover:brightness-105 transition inline-flex items-center gap-2">
              Смотреть каталог <ArrowRight size={18} />
            </Link>
            <Link href="/top" className="rounded-full px-6 py-3.5 border border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.07] transition inline-flex items-center gap-2">
              <Star size={18} className="text-[#f0d79f]" /> ТОП подборка
            </Link>
          </div>

          {genres.length ? (
            <div className="flex flex-wrap gap-2 mt-7">
              {genres.map((genre) => (
                <Link key={genre.slug} href={`/genre/${genre.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white hover:border-[#c9a86a]/25">
                  {genre.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      {anime.length > 0 ? <SectionGrid title="Аниме" href="/anime" movies={anime} /> : null}
    </div>
  );
}
