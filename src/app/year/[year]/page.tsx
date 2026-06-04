import { notFound } from "next/navigation";
import { ListPage } from "@/lib/list-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props) {
  const { year } = await params;
  return {
    title: `Фильмы и сериалы ${year} года — MARIOFILM`,
    description: `Каталог фильмов, сериалов, мультфильмов и аниме ${year} года.`,
  };
}

export default async function YearPage({ params, searchParams }: Props) {
  const { year } = await params;
  const { sort } = await searchParams;
  const parsedYear = Number(year);
  if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 2100) notFound();

  return <ListPage title={`Фильмы и сериалы ${parsedYear} года`} year={parsedYear} sort={sort} />;
}
