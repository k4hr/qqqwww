import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярные сериалы смотреть онлайн — REDFILM", alternates: { canonical: "/series/popular" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="Популярные сериалы" type={ContentType.SERIES} sort="popular" page={Number(page) || 1} />; }
