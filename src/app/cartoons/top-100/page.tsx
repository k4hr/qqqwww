import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const revalidate = 600;

export const metadata = { title: "ТОП мультфильмов — REDFILM", description: "Лучшие мультфильмы REDFILM с высоким рейтингом, голосами и доступным плеером.", alternates: { canonical: "/cartoons/top-100" } };
type Props = { searchParams: Promise<{ page?: string; sort?: string; year?: string; genre?: string; country?: string }> };
export default async function Page({ searchParams }: Props) { const { page, sort, year, genre, country } = await searchParams; return <ListPage title="ТОП мультфильмов" type={ContentType.CARTOON} sort={sort || "top"} yearFilter={year} genreSlug={genre} country={country} showYearFilter showGenreFilter showCountryFilter page={Number(page) || 1} />; }
