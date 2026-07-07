import { ContentType } from "@prisma/client";
import { TrendListPage } from "@/lib/trend-list-page";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Лучшие фильмы ${year} смотреть онлайн — REDFILM`, alternates: { canonical: `/best/movies/${year}` } };
}
export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <TrendListPage title={`Лучшие фильмы ${year}`} href={`/best/movies/${year}`} type={ContentType.MOVIE} year={Number(year)} mode="best" />;
}
