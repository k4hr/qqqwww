import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ sort?: string; year?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year } = await searchParams;
  return <ListPage title={year ? `Аниме ${year}` : "Аниме"} type={ContentType.ANIME} sort={sort} year={year ? Number(year) : undefined} />;
}
