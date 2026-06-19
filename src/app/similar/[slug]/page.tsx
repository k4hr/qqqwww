import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { similarIntro, sortSimilarMovies } from "@/lib/similar";
import { getContentTypePath, getContentTypeLabel } from "@/lib/content";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findFirst({ where: { slug, ...vibixPublicMovieWhere } });
  if (!movie) return {};

  return {
    title: `10 фильмов похожих на ${movie.titleRu} — REDFILM`,
    description: `Подборка фильмов и сериалов, похожих на ${movie.titleRu}: похожие жанры, атмосфера, темы, актёры, рейтинги и ссылки для просмотра на REDFILM.`,
  };
}

export default async function SimilarPage({ params }: Props) {
  const { slug } = await params;

  const movie = await prisma.movie.findFirst({
    where: { slug, ...vibixPublicMovieWhere },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!movie) notFound();

  const candidates = await prisma.movie.findMany({
    where: { ...vibixPublicMovieWhere, id: { not: movie.id } },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { sortOrder: "asc" } },
    },
    take: 1200,
  });

  const similar = sortSimilarMovies(movie, candidates, 10);
  const fallback = similar.length < 10
    ? await prisma.movie.findMany({
        where: { ...vibixPublicMovieWhere, id: { not: movie.id }, type: movie.type },
        orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
        take: 10 - similar.length,
      })
    : [];

  return (
    <div className="container py-5">
      <div className="mb-5 text-sm text-[#777781]">
        <Link href="/">REDFILM</Link> » <Link href={getContentTypePath(movie.type)}>{getContentTypeLabel(movie.type)}</Link> » <Link href={`/movie/${movie.slug}`}>{movie.titleRu}</Link> » похожие фильмы
      </div>

      <section className="glass-panel section-glow mb-6 rounded-[26px] p-5 md:p-6">
        <div className="grid md:grid-cols-[150px_1fr] gap-5">
          <Link href={`/movie/${movie.slug}`} className="poster-fallback relative block aspect-[2/3] overflow-hidden rounded-2xl border border-white/10">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="150px" unoptimized /> : null}
          </Link>

          <div>
            <h1 className="mb-3 text-2xl font-black tracking-[-.03em] text-white md:text-3xl">
              Фильмы похожие на {movie.titleRu}
            </h1>
            <p className="mb-4 max-w-4xl leading-relaxed text-[#a9a9b2]">{similarIntro(movie)}</p>
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

      <section className="glass-panel section-glow mb-6 rounded-[26px] p-5">
        <h2 className="mb-5 text-xl font-black text-white md:text-2xl">ТОП 10 похожих фильмов и сериалов</h2>

        {similar.length ? (
          <div className="space-y-4">
            {similar.map((item, index) => (
              <article key={item.id} className="grid gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0 md:grid-cols-[84px_1fr]">
                <Link href={`/movie/${item.slug}`} className="poster-fallback relative aspect-[2/3] w-[84px] overflow-hidden rounded-xl border border-white/10">
                  {item.posterUrl ? <Image src={item.posterUrl} alt={item.titleRu} fill className="object-cover" sizes="84px" unoptimized /> : null}
                </Link>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {index + 1}. <Link href={`/movie/${item.slug}`} className="hover:text-[#e50914]">{item.titleRu} ({item.year})</Link>
                  </h3>
                  {item.titleOriginal ? <div className="mt-1 text-sm text-[#777781]">{item.titleOriginal}</div> : null}
                  <p className="line-clamp-3 mt-2 text-[#a9a9b2]">{item.description}</p>
                  <div className="mt-2 text-sm text-[#a9a9b2]">
                    <b>Почему похож:</b> {item.similarityReasons.join("; ")}.
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link href={`/watch/${item.slug}`} className="mf-btn mf-btn-primary">Смотреть на REDFILM</Link>
                    <Link href={`/similar/${item.slug}`} className="mf-btn">Похожие на этот</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-[#a1a1aa]">Пока в базе недостаточно карточек для автоматической подборки. Запусти массовый импорт в админке.</div>
        )}
      </section>

      {fallback.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-black text-white">Ещё можно посмотреть</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {fallback.map((item) => <MovieCard key={item.slug} movie={item} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
