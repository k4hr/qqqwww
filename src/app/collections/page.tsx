import Link from "next/link";
import { collections } from "@/lib/collections";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подборки фильмов и сериалов — REDFILM",
  description: "Подборки фильмов, сериалов, мультфильмов и аниме на REDFILM.",
};

export default function CollectionsPage() {
  return (
    <div className="container py-6">
      <h1 className="mb-6 text-3xl font-black tracking-[-.035em] text-white">Подборки фильмов и сериалов</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((collection) => (
          <Link key={collection.slug} href={`/collections/${collection.slug}`} className="glass-panel section-glow rounded-3xl p-5 transition-all hover:-translate-y-1 hover:border-[#e50914]/60">
            <h2 className="mb-2 text-xl font-black text-white">{collection.h1}</h2>
            <p className="leading-relaxed text-[#a1a1aa]">{collection.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
