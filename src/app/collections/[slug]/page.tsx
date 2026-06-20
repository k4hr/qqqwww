import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { getCollection } from "@/lib/collections";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { timedMovieQuery } from "@/lib/query-performance";
import { getSeoTopic, seoTopics, topicWhere } from "@/lib/seo-pages";
import { JsonLd } from "@/components/json-ld";
import { genrePath, siteUrl, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const topic = getSeoTopic(slug);
  if (topic) return { title: `${topic[1]} смотреть онлайн — REDFILM`, description: `${topic[1]}: тематическая подборка доступных фильмов и сериалов с рейтингами и описаниями.`, alternates: { canonical: `/collections/${slug}` } };
  const collection = getCollection(slug);
  if (!collection) return {};
  return {
    title: collection.title,
    description: collection.description,
    alternates: { canonical: `/collections/${slug}` },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = getCollection(slug);
  const topic = getSeoTopic(slug);
  const topicFilter = topicWhere(slug);
  if (!collection && (!topic || !topicFilter)) notFound();

  const movies = await timedMovieQuery(`collection ${slug}`, () => prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), topicFilter ?? collection!.where] },
    orderBy: collection?.orderBy ?? [{ kpRating: "desc" }, { createdAt: "desc" }],
    include: { genres: { include: { genre: true } } },
    take: 48,
  }));
  if (topic && movies.length < 8) notFound();
  const h1 = topic?.[1] ?? collection!.h1;
  const description = topic ? `${topic[1]} собраны по названиям, описаниям и жанровым признакам. В подборку попадают только доступные для просмотра карточки REDFILM.` : collection!.description;
  const genres = [...new Map(movies.flatMap((movie) => movie.genres.map((item) => [item.genre.slug, item.genre] as const))).values()].slice(0, 8);
  const relatedTopics = seoTopics.filter((item) => item[0] !== slug).slice(0, 6);

  return (
    <div className="container py-6">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: siteUrl(`/collections/${slug}`), mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) } }} />
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-3xl font-black tracking-[-.035em] text-white">{h1}</h1>
        <p className="mt-3 max-w-4xl leading-relaxed text-[#a1a1aa]">{description}</p>
      </section>

      {movies.length ? (
        <div className="movie-grid">
          {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-[#a1a1aa]">
          Каталог обновляется. Фильмы скоро появятся.
        </div>
      )}
      <section className="mf-panel mt-7 p-5 sm:p-6"><h2 className="text-xl font-black text-white">Почему эти фильмы в подборке</h2><p className="mt-3 max-w-4xl leading-relaxed text-[#a1a1aa]">Картины объединены общей темой, жанровыми признаками и ключевыми мотивами. В списке остаются только доступные для просмотра позиции каталога.</p><h3 className="mt-6 font-black text-white">Смотрите также</h3><div className="mt-3 flex flex-wrap gap-2">{relatedTopics.map((item) => <Link key={item[0]} href={`/collections/${item[0]}`} className="mf-btn">{item[1]}</Link>)}{genres.map((genre) => <Link key={genre.slug} href={genrePath(genre)} className="mf-btn">{genre.name}</Link>)}</div></section>
    </div>
  );
}
