import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП 100 REDFILM — фильмы, сериалы, мультфильмы и аниме", description: "ТОП 100 REDFILM: культовые фильмы, сериалы, мультфильмы и аниме с высоким рейтингом, большим количеством голосов и доступным плеером.", alternates: { canonical: "/top-100" } };
type Props = { searchParams: Promise<{ type?: string; page?: string }> };
function parseType(type?: string) {
  if (type === "series" || type === "SERIES") return ContentType.SERIES;
  if (type === "cartoon" || type === "cartoons" || type === "CARTOON") return ContentType.CARTOON;
  if (type === "anime" || type === "ANIME") return ContentType.ANIME;
  if (type === "movie" || type === "MOVIE") return ContentType.MOVIE;
  return undefined;
}
function titleFor(type?: ContentType) {
  if (type === ContentType.SERIES) return "ТОП сериалов";
  if (type === ContentType.CARTOON) return "ТОП мультфильмов";
  if (type === ContentType.ANIME) return "ТОП аниме";
  if (type === ContentType.MOVIE) return "ТОП 100 фильмов";
  return "ТОП 100 REDFILM";
}
export default async function Page({ searchParams }: Props) { const { type, page } = await searchParams; const contentType = parseType(type); return <ListPage title={titleFor(contentType)} type={contentType} sort="top" showTypeFilter page={Number(page) || 1} />; }
