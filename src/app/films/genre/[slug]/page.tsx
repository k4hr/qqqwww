import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { genreLabel } from "@/lib/catalog-taxonomy";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; country?: string; year?: string; page?: string }> };
export async function generateMetadata({ params }: Props) { const { slug } = await params; const label = genreLabel(slug); return { title: `Фильмы жанра ${label} смотреть онлайн — REDFILM`, description: `Лучшие фильмы жанра ${label}: выдача REDFILM по популярности, рейтингам и доступности просмотра.` }; }
export default async function Page({ params, searchParams }: Props) { const { slug } = await params; const { sort, country, year, page } = await searchParams; return <ListPage title={`Фильмы: ${genreLabel(slug)}`} type={ContentType.MOVIE} genreSlug={slug} yearFilter={year} sort={sort || "popular"} country={country} showCountryFilter showYearFilter page={Number(page) || 1} />; }
