import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import type { ContentType } from "@prisma/client";
import { parseSort } from "@/lib/content";

type Props = {
  title: string;
  type?: ContentType;
  year?: number;
  genreSlug?: string;
  sort?: string;
};

export async function ListPage({ title, type, year, genreSlug, sort }: Props) {
  const movies = await prisma.movie.findMany({
    where: {
      isPublished: true,
      ...(type ? { type } : {}),
      ...(year ? { year } : {}),
      ...(genreSlug ? { genres: { some: { genre: { slug: genreSlug } } } } : {}),
    },
    orderBy: parseSort(sort),
    take: 96,
  });

  return (
    <div className="container py-5">
      <h1 className="text-3xl font-medium mb-5 text-[#333]">{title}</h1>

      <div className="flex flex-wrap gap-2 mb-5">
        <FilterLink href="?sort=latest" label="Последние" active={!sort || sort === "latest"} />
        <FilterLink href="?sort=popular" label="Популярные" active={sort === "popular"} />
        <FilterLink href="?sort=rating" label="По рейтингу" active={sort === "rating"} />
        <FilterLink href="?sort=year" label="По году" active={sort === "year"} />
      </div>

      {movies.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {movies.map((movie) => (
            <MovieCard key={movie.slug} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#ddd] p-8 text-neutral-600">
          Пока нет карточек в этом разделе.
        </div>
      )}
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={active ? "bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm" : "bg-white border border-[#ddd] px-5 py-3 text-neutral-600 rounded-sm hover:border-[#e50914]"}
    >
      {label}
    </Link>
  );
}
