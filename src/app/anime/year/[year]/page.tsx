import { notFound } from "next/navigation";
import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
import { isValidYear } from "@/lib/content";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ sort?: string; country?: string; genre?: string; page?: string }> };
export async function generateMetadata({ params }: Props) { const { year } = await params; const parsedYear = Number(year); if (!isValidYear(parsedYear)) return {}; return { title: `Аниме ${parsedYear} смотреть онлайн — REDFILM`, description: `Аниме ${parsedYear} года онлайн в хорошем качестве на REDFILM.` }; }
export default async function Page({ params, searchParams }: Props) { const { year } = await params; const { sort, country, genre, page } = await searchParams; const parsedYear = Number(year); if (!isValidYear(parsedYear)) notFound(); return <ListPage title={`Аниме ${parsedYear} смотреть онлайн`} type={ContentType.ANIME} year={parsedYear} sort={sort || (parsedYear >= new Date().getFullYear() - 2 ? "fresh" : "popular")} country={country} genreSlug={genre} showCountryFilter showGenreFilter page={Number(page) || 1} />; }
