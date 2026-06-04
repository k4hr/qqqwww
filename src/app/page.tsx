import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { ContentType } from "@prisma/client";
import { collectionLinksForYear } from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [movies, series, cartoons, anime, genres] = await Promise.all([
    prisma.movie.findMany({ where: { type: ContentType.MOVIE, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.SERIES, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.CARTOON, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.ANIME, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 18 }),
  ]);

  const quickLinks = collectionLinksForYear(currentYear);

  return (
    <div className="container py-4">
      <section className="mf-panel p-5 md:p-7 mb-6">
        <div className="flex flex-wrap gap-2 mb-5">
          <Link href={`/movies/${currentYear}`} className="mf-btn">★ Фильмы {currentYear}</Link>
          <Link href={`/series/${currentYear}`} className="mf-btn">Сериалы {currentYear}</Link>
          <Link href="/collections/top-100" className="mf-btn">ТОП100 в этом месяце</Link>
          <Link href="/latest" className="mf-btn">Последние обновления</Link>
          <Link href="/collections" className="mf-btn">Подборки</Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-medium mb-4 text-[#333]">REDFILM — фильмы смотреть онлайн</h1>
        <p className="text-neutral-600 max-w-4xl leading-relaxed">
          Каталог фильмов, сериалов, мультфильмов и аниме. Здесь можно найти карточки с описаниями, рейтингами, трейлерами и подборками.
        </p>

        <div className="flex flex-wrap gap-2 mt-5">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm bg-[#f7f7f7] border border-[#ddd] px-3 py-2 hover:border-[#e50914]">
              {item.label}
            </Link>
          ))}
          {genres.slice(0, 10).map((genre) => (
            <Link key={genre.slug} href={`/genre/${genre.slug}/${currentYear}`} className="text-sm bg-[#f7f7f7] border border-[#ddd] px-3 py-2 hover:border-[#e50914]">
              {genre.name} {currentYear}
            </Link>
          ))}
        </div>
      </section>

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      {anime.length > 0 ? <SectionGrid title="Аниме" href="/anime" movies={anime} /> : null}
    </div>
  );
}
