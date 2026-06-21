import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Аниме смотреть онлайн — REDFILM", description: "Аниме онлайн: популярные, новые, рейтинговые и доступные тайтлы REDFILM.", alternates: { canonical: "/anime" } };
type Props = { searchParams: Promise<{ sort?: string; year?: string; genre?: string; country?: string; page?: string }> };
export default async function Page({ searchParams }: Props) {
  const { sort, year, genre, country, page } = await searchParams;
  return <ListPage title={year ? `Аниме ${year}` : "Аниме"} type={ContentType.ANIME} sort={sort} yearFilter={year} genreSlug={genre} country={country} showCountryFilter showYearFilter showGenreFilter page={Number(page) || 1} />;
}
