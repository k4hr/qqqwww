import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { getCollection } from "@/lib/collections";

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

  const movies = await prisma.movie.findMany({
    where: {
      isPublished: true,
      ...collection.where,
    },
    orderBy: collection.orderBy,
    take: slug === "top-100" ? 100 : 96,
  });

  return (
    <div className="container py-5">
      <h1 className="text-3xl font-medium mb-3 text-[#333]">{collection.h1}</h1>
      <p className="text-neutral-600 max-w-4xl leading-relaxed mb-5">{collection.description}</p>

      {movies.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
        </div>
      ) : (
        <div className="bg-white border border-[#ddd] p-8 text-neutral-600">
          В подборке пока нет карточек. Запусти массовый импорт в админке.
        </div>
      )}
    </div>
  );
}
