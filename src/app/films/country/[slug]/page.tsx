import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { countryLabel } from "@/lib/catalog-taxonomy";
export const revalidate = 600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; genre?: string; year?: string; page?: string }> };
export async function generateMetadata({ params }: Props) { const { slug } = await params; const label = countryLabel(slug); return { title: `Фильмы ${label} смотреть онлайн — REDFILM`, description: `Фильмы страны ${label}: популярное, новинки и топовые картины с плеером REDFILM.` }; }
export default async function Page({ params, searchParams }: Props) { const { slug } = await params; const { sort, genre, year, page } = await searchParams; return <ListPage title={`Фильмы: ${countryLabel(slug)}`} type={ContentType.MOVIE} country={slug} genreSlug={genre} yearFilter={year} sort={sort || "popular"} showYearFilter showGenreFilter page={Number(page) || 1} />; }
