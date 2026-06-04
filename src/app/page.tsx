import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { ContentType } from "@prisma/client";

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
    <div className="container py-4">
      <section className="bg-white border border-mario-line p-5 md:p-7 mb-5">
        <div className="flex flex-wrap gap-2 mb-5">
          <Link href="/movies?year=2026" className="bg-white border border-mario-green text-neutral-700 px-6 py-3 rounded-sm hover:bg-mario-green hover:text-white">★ Фильмы 2026</Link>
          <Link href="/series?year=2026" className="bg-white border border-mario-green text-neutral-700 px-6 py-3 rounded-sm hover:bg-mario-green hover:text-white">Сериалы 2026</Link>
          <Link href="/top" className="bg-white border border-mario-green text-neutral-700 px-6 py-3 rounded-sm hover:bg-mario-green hover:text-white">ТОП100 в этом месяце</Link>
          <Link href="/latest" className="bg-white border border-mario-green text-neutral-700 px-6 py-3 rounded-sm hover:bg-mario-green hover:text-white">Последние обновления</Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-medium mb-4">MARIOFILM — фильмы смотреть онлайн</h1>
        <p className="text-neutral-600 max-w-3xl leading-relaxed">
          Каталог фильмов, сериалов, мультфильмов и аниме. На старте сайт работает как база карточек с описаниями, рейтингами, трейлерами и подборками. Плеер подключается отдельным модулем после одобрения партнёрского доступа.
        </p>

        {genres.length ? (
          <div className="flex flex-wrap gap-2 mt-5">
            {genres.map((genre) => (
              <Link key={genre.slug} href={`/genre/${genre.slug}`} className="text-sm bg-[#f5f5f5] border border-mario-line px-3 py-2 hover:border-mario-green">
                {genre.name}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      {anime.length > 0 ? <SectionGrid title="Аниме" href="/anime" movies={anime} /> : null}
    </div>
  );
}
