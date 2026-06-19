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
  description?: string;
};

export async function ListPage({ title, type, year, genreSlug, sort, description }: Props) {
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
    <div className="container py-6">
      <div className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-3xl font-black tracking-[-.035em] text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-4xl leading-relaxed text-[#a9a9b2]">{description}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterLink href="?sort=latest" label="Последние" active={!sort || sort === "latest"} />
          <FilterLink href="?sort=popular" label="Популярные" active={sort === "popular"} />
          <FilterLink href="?sort=rating" label="По рейтингу" active={sort === "rating"} />
          <FilterLink href="?sort=year" label="По году" active={sort === "year"} />
        </div>
      </div>

      {movies.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {movies.map((movie) => (
            <MovieCard key={movie.slug} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-[#a1a1aa]">
          Пока нет карточек в этом разделе. Запусти массовый импорт в админке, и страница начнёт наполняться автоматически.
        </div>
      )}
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={active ? "mf-btn mf-btn-primary" : "mf-btn"}
    >
      {label}
    </Link>
  );
}
