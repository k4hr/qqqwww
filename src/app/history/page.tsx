import type { Metadata } from "next";
import { ClientLibrary } from "@/components/client-library";

export const revalidate = 86400;

export const metadata: Metadata = { title: "Недавно смотрели — REDFILM", description: "История недавно открытых фильмов и сериалов REDFILM на этом устройстве.", robots: { index: false, follow: true } };

export default function HistoryPage() {
  return <div className="container py-6"><section className="rf-catalog-intro mb-7"><h1 className="rf-page-title">Недавно смотрели</h1><p className="rf-copy mt-3">История просмотра хранится только в вашем браузере.</p></section><ClientLibrary mode="history" /></div>;
}
