import { notFound } from "next/navigation";
import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { isValidYear } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props) {
  const { year } = await params;
  const parsedYear = Number(year);
  if (!isValidYear(parsedYear)) return {};
  return {
    title: `Мультфильмы ${parsedYear} смотреть онлайн — REDFILM`,
    description: `Мультфильмы ${parsedYear} года онлайн в хорошем качестве: карточки, описания, рейтинги, трейлеры и подборки на REDFILM.`,
  };
}

export default async function TypeYearPage({ params, searchParams }: Props) {
  const { year } = await params;
  const { sort } = await searchParams;
  const parsedYear = Number(year);
  if (!isValidYear(parsedYear)) notFound();

  return (
    <ListPage
      title={`Мультфильмы ${parsedYear} смотреть онлайн`}
      type={ContentType.CARTOON}
      year={parsedYear}
      sort={sort}
      description={`Собрали мультфильмы ${parsedYear} года: новые карточки, рейтинги, описание, актёры, трейлеры и похожие тайтлы.`}
    />
  );
}
