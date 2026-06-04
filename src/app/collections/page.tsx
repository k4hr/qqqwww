import Link from "next/link";
import { collections } from "@/lib/collections";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подборки фильмов и сериалов — REDFILM",
  description: "Подборки фильмов, сериалов, мультфильмов и аниме на REDFILM.",
};

export default function CollectionsPage() {
  return (
    <div className="container py-5">
      <h1 className="text-3xl font-medium mb-5 text-[#333]">Подборки фильмов и сериалов</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((collection) => (
          <Link key={collection.slug} href={`/collections/${collection.slug}`} className="bg-white border border-[#ddd] p-5 hover:border-[#e50914] transition-colors">
            <h2 className="text-xl font-bold text-[#333] mb-2">{collection.h1}</h2>
            <p className="text-neutral-600 leading-relaxed">{collection.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
