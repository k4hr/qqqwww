import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ sort?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort } = await searchParams;
  return <ListPage title="Последние обновления" sort={sort} />;
}
