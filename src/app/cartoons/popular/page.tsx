import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярные мультфильмы смотреть онлайн — REDFILM", description: "Популярные мультфильмы REDFILM по рейтингам, голосам и качеству карточек.", alternates: { canonical: "/cartoons/popular" } };
type Props = { searchParams: Promise<{ page?: string }> };
export default async function Page({ searchParams }: Props) { const { page } = await searchParams; return <ListPage title="Популярные мультфильмы" type={ContentType.CARTOON} sort="popular" page={Number(page) || 1} />; }
