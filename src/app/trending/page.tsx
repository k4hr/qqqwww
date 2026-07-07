import { TrendListPage } from "@/lib/trend-list-page";

export const revalidate = 300;

export const metadata = { title: "Фильмы и сериалы в тренде — REDFILM", alternates: { canonical: "/trending" } };

export default function TrendingPage() {
  return <TrendListPage title="В тренде" href="/trending" mode="trending" />;
}
