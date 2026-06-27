import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Популярное аниме смотреть онлайн — REDFILM", description: "Популярное аниме REDFILM по рейтингам, голосам и качеству карточек.", alternates: { canonical: "/anime/popular" } };
type Props = { searchParams: Promise<{ page?: string; sort?: string; year?: string; genre?: string; country?: string }> };
export default async function Page({ searchParams }: Props) { const { page, sort, year, genre, country } = await searchParams; return <ListPage title="Популярное аниме" type={ContentType.ANIME} sort={sort || "popular"} yearFilter={year} genreSlug={genre} country={country} showYearFilter showGenreFilter showCountryFilter page={Number(page) || 1} />; }
