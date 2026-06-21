import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярные фильмы и сериалы смотреть онлайн — REDFILM", description: "Автоматическая подборка популярных фильмов и сериалов REDFILM по голосам, рейтингам и качеству карточек.", alternates: { canonical: "/popular" } };
type Props = { searchParams: Promise<{ type?: string; page?: string }> };
export default async function Page({ searchParams }: Props) { const { type, page } = await searchParams; const contentType = type === "series" || type === "SERIES" ? ContentType.SERIES : type === "movie" || type === "MOVIE" ? ContentType.MOVIE : undefined; return <ListPage title={contentType === ContentType.SERIES ? "Популярные сериалы" : contentType === ContentType.MOVIE ? "Популярные фильмы" : "Популярные фильмы и сериалы"} type={contentType} sort="popular" showTypeFilter page={Number(page) || 1} />; }
