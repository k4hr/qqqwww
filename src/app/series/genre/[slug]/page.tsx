import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { genreLabel } from "@/lib/catalog-taxonomy";
export const revalidate = 600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; country?: string; year?: string; page?: string }> };
export async function generateMetadata({ params }: Props) { const { slug } = await params; const label = genreLabel(slug); return { title: `Сериалы жанра ${label} смотреть онлайн — REDFILM`, description: `Лучшие сериалы жанра ${label}: автоматическая выдача REDFILM.` }; }
export default async function Page({ params, searchParams }: Props) { const { slug } = await params; const { sort, country, year, page } = await searchParams; return <ListPage title={`Сериалы: ${genreLabel(slug)}`} type={ContentType.SERIES} genreSlug={slug} yearFilter={year} sort={sort || "popular"} country={country} showCountryFilter showYearFilter page={Number(page) || 1} />; }
