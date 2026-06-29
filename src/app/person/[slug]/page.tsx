import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { isPublicCastLink, isPublicPersonName } from "@/lib/person-quality";
import { normalizeSlug } from "@/lib/seo-slugs";
import { personPath, siteUrl, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function findPersonBySlug(slug: string) {
  const people = await prisma.person.findMany({
    where: { nameRu: { not: "" } },
    select: { id: true, nameRu: true, nameOriginal: true, photoUrl: true },
    orderBy: { nameRu: "asc" },
    take: 25_000,
  }).catch(() => []);
  return people.find((person) => isPublicPersonName(person.nameRu) && normalizeSlug(person.nameRu) === slug) ?? null;
}

async function publicMoviesForPerson(personId: string) {
  return prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { cast: { some: { personId } } }] },
    include: { genres: { include: { genre: true } }, cast: { include: { person: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { year: "desc" }],
    take: 72,
  }).then((movies) => movies.filter((movie) => movie.cast.some((cast) => cast.personId === personId && isPublicCastLink(cast)))).catch(() => []);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const person = await findPersonBySlug((await params).slug);
  if (!person) return {};
  const title = `Фильмы с ${person.nameRu} смотреть онлайн — REDFILM`;
  const description = `Подборка фильмов и сериалов с ${person.nameRu}: доступные тайтлы REDFILM, рейтинги, жанры и быстрый переход к просмотру.`;
  return { title, description, alternates: { canonical: personPath(person.nameRu) }, openGraph: { title, description, url: personPath(person.nameRu) } };
}

export default async function PersonPage({ params }: Props) {
  const { slug } = await params;
  const person = await findPersonBySlug(slug);
  if (!person) notFound();
  const canonical = personPath(person.nameRu);
  if (canonical !== `/person/${slug}`) permanentRedirect(canonical);

  const movies = await publicMoviesForPerson(person.id);
  if (movies.length < 2) notFound();

  const genres = [...new Map(movies.flatMap((movie) => movie.genres.map((item) => [item.genre.slug, item.genre] as const))).values()].slice(0, 8);

  return <div className="container py-6">
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Фильмы с ${person.nameRu}`,
      url: siteUrl(personPath(person.nameRu)),
      about: { "@type": "Person", name: person.nameRu, alternateName: person.nameOriginal || undefined, image: person.photoUrl || undefined },
      mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) },
    }} />

    <nav className="mb-5 text-sm text-[#85858f]"><Link href="/">REDFILM</Link> / Актёры / {person.nameRu}</nav>

    <section className="glass-panel section-glow mb-6 rounded-[26px] p-5 sm:p-7">
      <span className="mf-badge">Персона</span>
      <h1 className="mt-3 text-[clamp(1.8rem,5vw,3.2rem)] font-black tracking-[-.035em] text-white">Фильмы с {person.nameRu} смотреть онлайн</h1>
      <p className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">На этой странице собраны доступные на REDFILM фильмы и сериалы с {person.nameRu}. Подборка помогает закрывать запросы «фильмы с {person.nameRu}», быстро выбирать тайтлы по рейтингу, жанрам и переходить к просмотру.</p>
      {person.nameOriginal ? <p className="mt-2 text-sm text-[#85858f]">Также известен как: {person.nameOriginal}</p> : null}
    </section>

    <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>

    <section className="mf-panel mt-7 p-5 sm:p-6">
      <h2 className="text-xl font-black text-white">Похожие страницы</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {genres.map((genre) => <Link key={genre.slug} href={`/genre/${genre.slug}`} className="mf-btn">{genre.name}</Link>)}
        <Link href="/popular" className="mf-btn">Популярное</Link>
        <Link href="/top-100" className="mf-btn">Топ 100</Link>
      </div>
    </section>
  </div>;
}
