import type { Metadata } from "next";
import { ClientLibrary } from "@/components/client-library";

export const revalidate = 86400;

export const metadata: Metadata = { title: "Избранное — REDFILM", description: "Сохранённые на этом устройстве фильмы и сериалы REDFILM.", robots: { index: false, follow: true } };

export default function FavoritesPage() {
  return <div className="container py-6"><section className="mb-6"><h1 className="text-[clamp(1.8rem,6vw,3.5rem)] font-black text-white">Избранное</h1><p className="mt-2 text-[#a1a1aa]">Фильмы и сериалы, сохранённые на этом устройстве.</p></section><ClientLibrary mode="favorites" /></div>;
}
