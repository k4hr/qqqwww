import { notFound } from "next/navigation";
import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { isValidYear } from "@/lib/content";

export const revalidate = 600;

type Props = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{
    sort?: string;
    country?: string;
    genre?: string;
    page?: string;
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { year } = await params;
  const parsedYear = Number(year);

  if (!isValidYear(parsedYear)) return {};

  return {
    title: `Сериалы ${parsedYear} смотреть онлайн — REDFILM`,
    description: `Сериалы ${parsedYear} года онлайн в хорошем качестве: популярные проекты, новинки и рейтинговые сериалы REDFILM.`,
    alternates: { canonical: `/series/year/${parsedYear}` },
  };
}

export default async function SeriesYearPage({ params, searchParams }: Props) {
  const { year } = await params;
  const { sort, country, genre, page } = await searchParams;
  const parsedYear = Number(year);

  if (!isValidYear(parsedYear)) notFound();

  return (
    <ListPage
      title={`Сериалы ${parsedYear} смотреть онлайн`}
      type={ContentType.SERIES}
      year={parsedYear}
      sort={sort || (parsedYear >= new Date().getFullYear() - 2 ? "fresh" : "popular")}
      country={country}
      genreSlug={genre}
      showCountryFilter
      showGenreFilter
      page={Number(page) || 1}
    />
  );
}
