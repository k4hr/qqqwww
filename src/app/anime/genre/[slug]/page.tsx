import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { genreLabel } from "@/lib/catalog-taxonomy";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; country?: string; year?: string; page?: string }> };
export default async function Page({ params, searchParams }: Props) { const { slug } = await params; const { sort, country, year, page } = await searchParams; return <ListPage title={`Аниме: ${genreLabel(slug)}`} type={ContentType.ANIME} genreSlug={slug} country={country} yearFilter={year} sort={sort || "popular"} showCountryFilter showYearFilter page={Number(page) || 1} />; }
