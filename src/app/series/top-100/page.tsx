import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП сериалов — REDFILM", alternates: { canonical: "/series/top-100" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="ТОП сериалов" type={ContentType.SERIES} sort="top" page={Number(page) || 1} />; }
