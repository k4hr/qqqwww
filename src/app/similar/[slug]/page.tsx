import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { similarIntro, sortSimilarMovies } from "@/lib/similar";
import { getContentTypePath, getContentTypeLabel } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findUnique({ where: { slug } });
  if (!movie) return {};

  return {
    title: `10 фильмов похожих на ${movie.titleRu} — REDFILM`,
    description: `Подборка фильмов и сериалов, похожих на ${movie.titleRu}: похожие жанры, атмосфера, темы, актёры, рейтинги и ссылки для просмотра на REDFILM.`,
  };
}

export default async function SimilarPage({ params }: Props) {
  const { slug } = await params;

  const movie = await prisma.movie.findUnique({
    where: { slug },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!movie) notFound();

  const candidates = await prisma.movie.findMany({
    where: { id: { not: movie.id }, isPublished: true },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { sortOrder: "asc" } },
    },
    take: 1200,
  });

  const similar = sortSimilarMovies(movie, candidates, 10);
  const fallback = similar.length < 10
    ? await prisma.movie.findMany({
        where: { id: { not: movie.id }, isPublished: true, type: movie.type },
        orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
        take: 10 - similar.length,
      })
    : [];

  return (
    <div className="container py-5">
      <div className="text-sm text-neutral-500 mb-5">
        <Link href="/">REDFILM</Link> » <Link href={getContentTypePath(movie.type)}>{getContentTypeLabel(movie.type)}</Link> » <Link href={`/movie/${movie.slug}`}>{movie.titleRu}</Link> » похожие фильмы
      </div>

      <section className="bg-white border border-[#ddd] p-5 md:p-6 mb-6">
        <div className="grid md:grid-cols-[150px_1fr] gap-5">
          <Link href={`/movie/${movie.slug}`} className="relative aspect-[2/3] bg-neutral-200 border border-[#ddd] overflow-hidden block">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="150px" unoptimized /> : null}
          </Link>

          <div>
            <h1 className="text-2xl md:text-3xl font-medium text-[#333] mb-3">
              Фильмы похожие на {movie.titleRu}
            </h1>
            <p className="text-neutral-600 leading-relaxed max-w-4xl mb-4">{similarIntro(movie)}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/movie/${movie.slug}`} className="mf-btn">Смотреть {movie.titleRu}</Link>
              <Link href={getContentTypePath(movie.type)} className="mf-btn">{getContentTypeLabel(movie.type)}</Link>
              {movie.genres.slice(0, 5).map((item) => (
                <Link key={item.genre.slug} href={`/genre/${item.genre.slug}`} className="mf-btn">{item.genre.name}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#ddd] p-5 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-[#333] mb-5">ТОП 10 похожих фильмов и сериалов</h2>

        {similar.length ? (
          <div className="space-y-4">
            {similar.map((item, index) => (
              <article key={item.id} className="grid md:grid-cols-[84px_1fr] gap-4 border-b border-[#eee] pb-4 last:border-b-0 last:pb-0">
                <Link href={`/movie/${item.slug}`} className="relative w-[84px] aspect-[2/3] bg-neutral-200 border border-[#ddd] overflow-hidden">
                  {item.posterUrl ? <Image src={item.posterUrl} alt={item.titleRu} fill className="object-cover" sizes="84px" unoptimized /> : null}
                </Link>
                <div>
                  <h3 className="text-lg font-bold text-[#333]">
                    {index + 1}. <Link href={`/movie/${item.slug}`} className="hover:text-[#e50914]">{item.titleRu} ({item.year})</Link>
                  </h3>
                  {item.titleOriginal ? <div className="text-sm text-neutral-500 mt-1">{item.titleOriginal}</div> : null}
                  <p className="text-neutral-600 mt-2 line-clamp-3">{item.description}</p>
                  <div className="text-sm text-neutral-600 mt-2">
                    <b>Почему похож:</b> {item.similarityReasons.join("; ")}.
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link href={`/movie/${item.slug}`} className="bg-[#e50914] text-white font-bold px-4 py-2 rounded-sm">Смотреть на REDFILM</Link>
                    <Link href={`/similar/${item.slug}`} className="border border-[#ddd] bg-white px-4 py-2 rounded-sm hover:border-[#e50914]">Похожие на этот</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-neutral-600">Пока в базе недостаточно карточек для автоматической подборки. Запусти массовый импорт в админке.</div>
        )}
      </section>

      {fallback.length ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-[#333] mb-4">Ещё можно посмотреть</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {fallback.map((item) => <MovieCard key={item.slug} movie={item} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
