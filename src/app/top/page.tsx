import { ListPage } from "@/lib/list-page";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ sort?: string }> };

export const metadata = {
  title: "ТОП фильмов и сериалов — MARIOFILM",
  description: "Популярные и рейтинговые фильмы и сериалы в каталоге MARIOFILM.",
};

export default async function TopPage({ searchParams }: Props) {
  const { sort } = await searchParams;
  return <ListPage title="ТОП фильмов и сериалов" sort={sort || "rating"} />;
}
