import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { countryLabel } from "@/lib/catalog-taxonomy";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; genre?: string; year?: string; page?: string }> };
export default async function Page({ params, searchParams }: Props) { const { slug } = await params; const { sort, genre, year, page } = await searchParams; return <ListPage title={`Аниме: ${countryLabel(slug)}`} type={ContentType.ANIME} country={slug} genreSlug={genre} yearFilter={year} sort={sort || "popular"} showYearFilter showGenreFilter page={Number(page) || 1} />; }
