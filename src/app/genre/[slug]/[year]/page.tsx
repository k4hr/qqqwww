import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { isValidYear } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; year: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, year } = await params;
  const parsedYear = Number(year);
  if (!isValidYear(parsedYear)) return {};
  const genre = await prisma.genre.findUnique({ where: { slug } });
  if (!genre) return {};
  return {
    title: `${genre.name} ${parsedYear} смотреть онлайн — REDFILM`,
    description: `Смотрите ${genre.name.toLowerCase()} ${parsedYear} года онлайн: фильмы, сериалы, рейтинги, описания и трейлеры на REDFILM.`,
  };
}

export default async function GenreYearPage({ params, searchParams }: Props) {
  const { slug, year } = await params;
  const { sort } = await searchParams;
  const parsedYear = Number(year);
  if (!isValidYear(parsedYear)) notFound();

  const genre = await prisma.genre.findUnique({ where: { slug } });
  if (!genre) notFound();

  return (
    <ListPage
      title={`${genre.name} ${parsedYear} смотреть онлайн`}
      genreSlug={slug}
      year={parsedYear}
      sort={sort}
      description={`Подборка в жанре ${genre.name.toLowerCase()} за ${parsedYear} год: карточки, описания, рейтинги, актёры и трейлеры.`}
    />
  );
}
