import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/seo-slugs";
import { personPath } from "@/lib/seo-links";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { MovieCard } from "@/components/movie-card";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function findPerson(slug: string) {
  const people = await prisma.person.findMany({ select: { id: true, nameRu: true, nameOriginal: true }, take: 500 });
  return people.find((person) => normalizeSlug(person.nameRu) === slug || (person.nameOriginal && normalizeSlug(person.nameOriginal) === slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const person = await findPerson((await params).slug);
  if (!person) return {};
  const title = `Фильмы с ${person.nameRu} смотреть онлайн — REDFILM`;
  return { title, description: `Фильмы и сериалы с участием ${person.nameRu}: роли, годы выхода, рейтинги и просмотр онлайн.`, alternates: { canonical: personPath(person.nameRu) } };
}

export default async function PersonPage({ params }: Props) {
  const person = await findPerson((await params).slug);
  if (!person) notFound();
  const movies = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { cast: { some: { personId: person.id } } }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 48 });
  if (!movies.length) notFound();
  return <div className="container py-6"><section className="mf-panel mb-6 p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Фильмы с {person.nameRu}</h1><p className="mt-4 text-[#b7b7c0]">Доступные фильмы и сериалы с участием {person.nameRu}. Страница сформирована по существующим данным актёрского состава.</p></section><div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></div>;
}
