import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ sort?: string; year?: string; country?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, country } = await searchParams;
  return <ListPage title={year ? `Фильмы ${year}` : "Фильмы"} type={ContentType.MOVIE} sort={sort} year={year ? Number(year) : undefined} country={country} showCountryFilter />;
}
