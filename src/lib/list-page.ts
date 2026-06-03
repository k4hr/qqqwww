import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import type { ContentType } from "@prisma/client";

export async function ListPage({ title, type }: { title: string; type?: ContentType }) {
  const movies = await prisma.movie.findMany({
    where: { isPublished: true, ...(type ? { type } : {}) },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    take: 60
  });

  return (
    <div className="container py-5">
      <h1 className="text-3xl font-medium mb-5">{title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </div>
  );
}
