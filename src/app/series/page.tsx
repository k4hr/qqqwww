import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Сериалы смотреть онлайн — REDFILM", description: "Основной каталог сериалов REDFILM с рейтингами, фильтрами по стране и ссылками на просмотр.", alternates: { canonical: "/series" } };
type Props = { searchParams: Promise<{ sort?: string; year?: string; genre?: string; country?: string; page?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, genre, country, page } = await searchParams;
  const yearLabel = year?.endsWith("s") ? `${year.slice(0, -1)}-е` : year;
  return <ListPage title={yearLabel ? `Сериалы ${yearLabel}` : "Сериалы"} type={ContentType.SERIES} sort={sort} yearFilter={year} genreSlug={genre} country={country} showCountryFilter page={Number(page) || 1} />;
}
