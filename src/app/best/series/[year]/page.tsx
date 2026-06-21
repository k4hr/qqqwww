import { ContentType } from "@prisma/client";
import { TrendListPage } from "@/lib/trend-list-page";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Лучшие сериалы ${year} смотреть онлайн — REDFILM`, alternates: { canonical: `/best/series/${year}` } };
}
export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <TrendListPage title={`Лучшие сериалы ${year}`} href={`/best/series/${year}`} type={ContentType.SERIES} year={Number(year)} mode="best" />;
}
