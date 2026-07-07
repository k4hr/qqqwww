import { ListPage } from "@/lib/list-page";
export const revalidate = 300;

export const metadata = { title: "Новинки фильмов и сериалов — REDFILM", description: "Последние обновления каталога фильмов и сериалов REDFILM.", alternates: { canonical: "/latest" } };
type Props = { searchParams: Promise<{ sort?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort } = await searchParams;
  return <ListPage title="Последние обновления" sort={sort || "fresh"} showTypeFilter showYearFilter />;
}
