import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { ContentType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [movies, series, cartoons, anime] = await Promise.all([
    prisma.movie.findMany({ where: { type: ContentType.MOVIE, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.SERIES, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.CARTOON, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.ANIME, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <div className="container py-4">
      <section className="mf-panel p-5 md:p-7 mb-6">
        <div className="flex flex-wrap gap-2 mb-5">
          <Link href="/movies?year=2026" className="mf-btn">★ Фильмы 2026</Link>
          <Link href="/series?year=2026" className="mf-btn">Сериалы 2026</Link>
          <Link href="/top" className="mf-btn">ТОП100 в этом месяце</Link>
          <Link href="/latest" className="mf-btn">Последние обновления</Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-medium mb-4 text-[#333]">REDFILM — фильмы смотреть онлайн</h1>
        <p className="text-neutral-600 max-w-4xl leading-relaxed">
          Каталог фильмов, сериалов, мультфильмов и аниме. Здесь можно найти карточки с описаниями, рейтингами, трейлерами и подборками.
        </p>
      </section>

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      {anime.length > 0 ? <SectionGrid title="Аниме" href="/anime" movies={anime} /> : null}
    </div>
  );
}
