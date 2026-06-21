import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярные фильмы смотреть онлайн — REDFILM", alternates: { canonical: "/films/popular" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="Популярные фильмы" type={ContentType.MOVIE} sort="popular" page={Number(page) || 1} />; }
