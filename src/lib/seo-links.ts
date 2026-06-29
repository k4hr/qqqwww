import type { Genre, Movie } from "@prisma/client";
import { buildCollectionSlug, buildFilmSeoSlug, buildSimilarSlug, buildWatchSlug, normalizeSlug } from "@/lib/seo-slugs";
import { extractCountries } from "@/lib/catalog-filters";

export const CANONICAL_SITE_ORIGIN = "https://redfilm.win";
export const CANONICAL_SITE_HOST = "redfilm.win";

export function canonicalSiteOrigin() {
  const raw = (
    process.env.SITE_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || CANONICAL_SITE_ORIGIN
  ).trim();

  try {
    const url = new URL(raw);
    const host = url.host.toLowerCase();
    if (host === "redfilm.online" || host === "www.redfilm.online" || host === "www.redfilm.win" || host === "redfilm.win") {
      return CANONICAL_SITE_ORIGIN;
    }
  } catch {
    // Invalid env values should not leak into canonical URLs.
  }

  return CANONICAL_SITE_ORIGIN;
}

export function siteUrl(path = "") {
  const base = canonicalSiteOrigin().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function filmPath(movie: Pick<Movie, "slug">) { return `/film/${buildFilmSeoSlug(movie)}`; }
export function watchPath(movie: Pick<Movie, "slug">) { return `/watch/${buildWatchSlug(movie)}`; }
export function similarPath(movie: Pick<Movie, "slug">) { return `/similar/${buildSimilarSlug(movie)}`; }
export function likePath(movie: Pick<Movie, "slug">) { return `/like/${buildSimilarSlug(movie)}`; }
export function seasonPath(movie: Pick<Movie, "titleRu" | "slug">, season: number) { return `/season/${normalizeSlug(movie.titleRu)}-${Math.max(1, Math.floor(season))}-sezon`; }
export function franchisePath(movie: Pick<Movie, "titleRu">) { return `/collection/${buildCollectionSlug(movie.titleRu)}`; }
export function genrePath(genre: Pick<Genre, "slug">) { return `/genre/${genre.slug}`; }
export function yearPath(movie: Pick<Movie, "year">) { return `/year/${movie.year}`; }
export function countryPath(country: string) {
  const normalized = country.toLowerCase().replaceAll("ё", "е");
  const aliases: Array<[string[], string]> = [
    [["сша", "united states", "usa"], "ssha"],
    [["великобрит", "united kingdom", "great britain"], "velikobritaniya"],
    [["франц", "france"], "frantsiya"],
    [["герман", "germany"], "germaniya"],
    [["испан", "spain"], "ispaniya"],
    [["итал", "italy"], "italiya"],
    [["росси", "russia"], "rossiya"],
    [["китай", "china"], "kitay"],
    [["япон", "japan"], "yaponiya"],
    [["инди", "india"], "indiya"],
    [["южная корея", "south korea", "korea, south"], "yuzhnaya-koreya"],
  ];
  const match = aliases.find(([names]) => names.some((name) => normalized.includes(name)));
  return match ? `/country/${match[1]}` : "/movies?country=all";
}
export function firstCountryPath(movie: Pick<Movie, "country">) {
  const country = extractCountries(movie.country)[0];
  return country ? countryPath(country) : null;
}
export function personPath(name: string) { return `/person/${normalizeSlug(name)}`; }
