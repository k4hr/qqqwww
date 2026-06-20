import type { Metadata } from "next";
import { ClientLibrary } from "@/components/client-library";

export const metadata: Metadata = { title: "Недавно смотрели — REDFILM", description: "История недавно открытых фильмов и сериалов REDFILM на этом устройстве.", robots: { index: false, follow: true } };

export default function HistoryPage() {
  return <div className="container py-6"><section className="mb-6"><h1 className="text-[clamp(1.8rem,6vw,3.5rem)] font-black text-white">Недавно смотрели</h1><p className="mt-2 text-[#a1a1aa]">История просмотра хранится только в вашем браузере.</p></section><ClientLibrary mode="history" /></div>;
}
