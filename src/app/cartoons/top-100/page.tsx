import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП мультфильмов — REDFILM", description: "Лучшие мультфильмы REDFILM с высоким рейтингом, голосами и доступным плеером.", alternates: { canonical: "/cartoons/top-100" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="ТОП мультфильмов" type={ContentType.CARTOON} sort="top" page={Number(page) || 1} />; }
