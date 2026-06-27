import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "ТОП 100 фильмов — REDFILM", alternates: { canonical: "/films/top-100" } };
type Props = { searchParams: Promise<{ page?: string; sort?: string; year?: string; genre?: string; country?: string }> };
export default async function Page({ searchParams }: Props) { const { page, sort, year, genre, country } = await searchParams; return <ListPage title="ТОП 100 фильмов" type={ContentType.MOVIE} sort={sort || "top"} yearFilter={year} genreSlug={genre} country={country} showYearFilter showGenreFilter showCountryFilter page={Number(page) || 1} />; }
