import type { Metadata } from "next";
import { ClientLibrary } from "@/components/client-library";

export const revalidate = 86400;

export const metadata: Metadata = { title: "Избранное — REDFILM", description: "Сохранённые на этом устройстве фильмы и сериалы REDFILM.", robots: { index: false, follow: true } };

export default function FavoritesPage() {
  return <div className="container py-6"><section className="rf-catalog-intro mb-7"><h1 className="rf-page-title">Избранное</h1><p className="rf-copy mt-3">Фильмы и сериалы, сохранённые на этом устройстве.</p></section><ClientLibrary mode="favorites" /></div>;
}
