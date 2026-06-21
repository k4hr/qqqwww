import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП 100 фильмов и сериалов — REDFILM", description: "ТОП 100 REDFILM: культовые фильмы и сериалы с высоким рейтингом, большим количеством голосов и доступным плеером.", alternates: { canonical: "/top-100" } };
type Props = { searchParams: Promise<{ type?: string; page?: string }> };
export default async function Page({ searchParams }: Props) { const { type, page } = await searchParams; const contentType = type === "series" || type === "SERIES" ? ContentType.SERIES : type === "movie" || type === "MOVIE" ? ContentType.MOVIE : undefined; return <ListPage title={contentType === ContentType.SERIES ? "ТОП сериалов" : contentType === ContentType.MOVIE ? "ТОП 100 фильмов" : "ТОП 100 фильмов и сериалов"} type={contentType} sort="top" showTypeFilter page={Number(page) || 1} />; }
