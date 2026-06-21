import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярное аниме смотреть онлайн — REDFILM", description: "Популярное аниме REDFILM по рейтингам, голосам и качеству карточек.", alternates: { canonical: "/anime/popular" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="Популярное аниме" type={ContentType.ANIME} sort="popular" page={Number(page) || 1} />; }
