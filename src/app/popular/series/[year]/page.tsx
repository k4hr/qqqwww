import { ContentType } from "@prisma/client";
import { TrendListPage } from "@/lib/trend-list-page";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Популярные сериалы ${year} смотреть онлайн — REDFILM`, alternates: { canonical: `/popular/series/${year}` } };
}
export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <TrendListPage title={`Популярные сериалы ${year}`} href={`/popular/series/${year}`} type={ContentType.SERIES} year={Number(year)} mode="popular" />;
}
