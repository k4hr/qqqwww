import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const revalidate = 600;

export const metadata = { title: "Мультфильмы смотреть онлайн — REDFILM", description: "Мультфильмы онлайн: популярные, новые, семейные, приключенческие и анимационные тайтлы REDFILM.", alternates: { canonical: "/cartoons" } };
type Props = { searchParams: Promise<{ sort?: string; year?: string; genre?: string; country?: string; page?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, genre, country, page } = await searchParams;
  return <ListPage title={year ? `Мультфильмы ${year}` : "Мультфильмы"} type={ContentType.CARTOON} sort={sort} yearFilter={year} genreSlug={genre} country={country} showCountryFilter showYearFilter showGenreFilter page={Number(page) || 1} />;
}
