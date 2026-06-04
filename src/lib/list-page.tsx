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
    <div className="container py-8">
      <section className="vip-panel hero-backdrop p-6 md:p-8 mb-8 overflow-hidden">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-4xl">{title}</h1>

        <div className="flex flex-wrap gap-2 mt-6">
          <FilterLink href="?sort=latest" label="Последние" active={!sort || sort === "latest"} />
          <FilterLink href="?sort=popular" label="Популярные" active={sort === "popular"} />
          <FilterLink href="?sort=rating" label="По рейтингу" active={sort === "rating"} />
          <FilterLink href="?sort=year" label="По году" active={sort === "year"} />
        </div>
      </section>

      {movies.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {movies.map((movie) => (
            <MovieCard key={movie.slug} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="vip-panel p-8 text-white/65">Пока нет карточек в этом разделе.</div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full border border-[#c9a86a]/30 bg-[#c9a86a]/15 px-5 py-3 text-[#f6dfaa] font-semibold"
          : "rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-white/65 hover:text-white hover:border-white/20"
      }
    >
      {label}
    </Link>
  );
}
