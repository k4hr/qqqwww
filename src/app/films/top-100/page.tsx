import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП 100 фильмов — REDFILM", alternates: { canonical: "/films/top-100" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="ТОП 100 фильмов" type={ContentType.MOVIE} sort="top" page={Number(page) || 1} />; }
