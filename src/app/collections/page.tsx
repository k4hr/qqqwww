import Link from "next/link";
import { publicCollections } from "@/lib/collections";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подборки фильмов и сериалов — REDFILM",
  description: "Подборки фильмов и сериалов на REDFILM.",
  alternates: { canonical: "/collections" },
};

export default function CollectionsPage() {
  return (
    <div className="container py-6">
      <h1 className="mb-6 text-3xl font-black tracking-[-.035em] text-white">Подборки фильмов и сериалов</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {publicCollections.map((collection) => (
          <Link key={collection.slug} href={`/collections/${collection.slug}`} className="glass-panel section-glow rounded-3xl p-5 transition-all hover:-translate-y-1 hover:border-[#e50914]/60">
            <h2 className="mb-2 text-xl font-black text-white">{collection.h1}</h2>
            <p className="leading-relaxed text-[#a1a1aa]">{collection.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
