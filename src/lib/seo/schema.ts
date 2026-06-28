import type { Movie } from "@prisma/client";
import { extractCountries } from "@/lib/catalog-filters";
import { siteUrl, similarPath, watchPath } from "@/lib/seo-links";
import { isPublicPersonName } from "@/lib/person-quality";

type GenreItem = { genre: { name: string; slug?: string } };
type CastItem = { person: { nameRu: string; nameOriginal?: string | null }; role?: string | null };
type SeoSchemaMovie = Pick<Movie, "titleRu" | "titleOriginal" | "description" | "year" | "posterUrl" | "backdropUrl" | "country" | "kpRating" | "imdbRating" | "tmdbRating" | "kpVotes" | "imdbVotes" | "tmdbVotes" | "vibixIframeUrl" | "vibixEmbedCode" | "vibixUploadedAt" | "updatedAt" | "type" | "duration" | "quality" | "slug"> & { genres: GenreItem[]; cast?: CastItem[] };

function compact<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)));
}

function ratingSchema(movie: SeoSchemaMovie) {
  const rating = movie.kpRating && movie.kpVotes && movie.kpVotes > 0
    ? { ratingValue: movie.kpRating, ratingCount: movie.kpVotes }
    : movie.imdbRating && movie.imdbVotes && movie.imdbVotes > 0
      ? { ratingValue: movie.imdbRating, ratingCount: movie.imdbVotes }
      : movie.tmdbRating && movie.tmdbVotes && movie.tmdbVotes > 0
        ? { ratingValue: movie.tmdbRating, ratingCount: movie.tmdbVotes }
        : null;

  if (!rating) return undefined;

  return {
    "@type": "AggregateRating",
    ratingValue: Number(rating.ratingValue.toFixed(1)),
    ratingCount: Number(rating.ratingCount),
    bestRating: 10,
    worstRating: 1,
  };
}

export function movieJsonLd(movie: SeoSchemaMovie) {
  const countries = extractCountries(movie.country);
  const people = (movie.cast ?? []).filter((item) => isPublicPersonName(item.person.nameRu)).slice(0, 12);
  return compact({
    "@context": "https://schema.org",
    "@type": movie.type === "SERIES" ? "TVSeries" : "Movie",
    name: movie.titleRu,
    alternateName: movie.titleOriginal || undefined,
    datePublished: String(movie.year),
    image: movie.posterUrl || movie.backdropUrl || undefined,
    description: movie.description,
    genre: movie.genres.map((item) => item.genre.name),
    countryOfOrigin: countries.map((name) => ({ "@type": "Country", name })),
    actor: people.filter((item) => !item.role || /actor|актер|актёр/i.test(item.role)).map((item) => compact({ "@type": "Person", name: item.person.nameRu, alternateName: item.person.nameOriginal || undefined })),
    aggregateRating: ratingSchema(movie),
    potentialAction: { "@type": "WatchAction", target: siteUrl(watchPath(movie)) },
    url: siteUrl(watchPath(movie)),
  });
}

export function videoObjectJsonLd(movie: SeoSchemaMovie) {
  return compact({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${movie.titleRu} (${movie.year}) смотреть онлайн`,
    description: movie.description,
    thumbnailUrl: [movie.backdropUrl, movie.posterUrl].filter(Boolean),
    uploadDate: movie.vibixUploadedAt?.toISOString?.() ?? movie.updatedAt?.toISOString?.(),
    embedUrl: siteUrl(watchPath(movie)),
    url: siteUrl(watchPath(movie)),
    duration: movie.duration ? `PT${movie.duration}M` : undefined,
    potentialAction: { "@type": "WatchAction", target: siteUrl(watchPath(movie)) },
  });
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl(item.url) })),
  };
}

export function itemListJsonLd(name: string, url: string, movies: Array<Pick<Movie, "titleRu" | "posterUrl" | "slug">>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: siteUrl(url),
    itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })),
  };
}

export function similarPageJsonLd(movie: SeoSchemaMovie, similar: Array<Pick<Movie, "titleRu" | "posterUrl" | "slug">>) {
  return [
    breadcrumbJsonLd([{ name: "REDFILM", url: "/" }, { name: movie.titleRu, url: watchPath(movie) }, { name: "Похожие фильмы", url: similarPath(movie) }]),
    itemListJsonLd(`Фильмы похожие на ${movie.titleRu}`, similarPath(movie), similar),
  ];
}
