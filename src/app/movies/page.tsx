import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const revalidate = 600;

export const metadata = { title: "Фильмы смотреть онлайн — REDFILM", description: "Основной каталог фильмов REDFILM с рейтингами, фильтрами по стране и ссылками на просмотр.", alternates: { canonical: "/movies" } };
type Props = { searchParams: Promise<{ sort?: string; year?: string; genre?: string; country?: string; page?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, genre, country, page } = await searchParams;
  const yearLabel = year?.endsWith("s") ? `${year.slice(0, -1)}-е` : year;
  return <ListPage title={yearLabel ? `Фильмы ${yearLabel}` : "Фильмы"} type={ContentType.MOVIE} sort={sort} yearFilter={year} genreSlug={genre} country={country} showCountryFilter showYearFilter showGenreFilter page={Number(page) || 1} />;
}
