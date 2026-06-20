import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { getCollection } from "@/lib/collections";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { timedMovieQuery } from "@/lib/query-performance";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return {};
  return {
    title: collection.title,
    description: collection.description,
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const movies = await timedMovieQuery(`collection ${slug}`, () => prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), collection.where] },
    orderBy: collection.orderBy,
    take: 48,
  }));

  return (
    <div className="container py-6">
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-3xl font-black tracking-[-.035em] text-white">{collection.h1}</h1>
        <p className="mt-3 max-w-4xl leading-relaxed text-[#a1a1aa]">{collection.description}</p>
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
    </div>
  );
}
