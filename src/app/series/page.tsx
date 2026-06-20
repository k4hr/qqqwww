import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Сериалы смотреть онлайн — REDFILM", description: "Основной каталог сериалов REDFILM с рейтингами, фильтрами по стране и ссылками на просмотр.", alternates: { canonical: "/series" } };
type Props = { searchParams: Promise<{ sort?: string; year?: string; country?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, country } = await searchParams;
  return <ListPage title={year ? `Сериалы ${year}` : "Сериалы"} type={ContentType.SERIES} sort={sort} year={year ? Number(year) : undefined} country={country} showCountryFilter />;
}
