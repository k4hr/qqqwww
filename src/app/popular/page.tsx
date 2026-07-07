import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const revalidate = 300;

export const metadata = { title: "Популярные фильмы, сериалы, мультфильмы и аниме — REDFILM", description: "Автоматическая подборка популярных фильмов, сериалов, мультфильмов и аниме REDFILM по голосам, рейтингам и качеству карточек.", alternates: { canonical: "/popular" } };
type Props = { searchParams: Promise<{ type?: string; page?: string; sort?: string; year?: string; genre?: string; country?: string }> };
function parseType(type?: string) {
  if (type === "series" || type === "SERIES") return ContentType.SERIES;
  if (type === "cartoon" || type === "cartoons" || type === "CARTOON") return ContentType.CARTOON;
  if (type === "anime" || type === "ANIME") return ContentType.ANIME;
  if (type === "movie" || type === "MOVIE") return ContentType.MOVIE;
  return undefined;
}
function titleFor(type?: ContentType) {
  if (type === ContentType.SERIES) return "Популярные сериалы";
  if (type === ContentType.CARTOON) return "Популярные мультфильмы";
  if (type === ContentType.ANIME) return "Популярное аниме";
  if (type === ContentType.MOVIE) return "Популярные фильмы";
  return "Популярное на REDFILM";
}
export default async function Page({ searchParams }: Props) { const { type, page, sort, year, genre, country } = await searchParams; const contentType = parseType(type); return <ListPage title={titleFor(contentType)} type={contentType} sort={sort || "popular"} yearFilter={year} genreSlug={genre} country={country} showTypeFilter showYearFilter showGenreFilter showCountryFilter page={Number(page) || 1} />; }
