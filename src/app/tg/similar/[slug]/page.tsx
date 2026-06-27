import Link from "next/link";
import { notFound } from "next/navigation";
import { TgMovieCard } from "@/components/tg/tg-movie-card";
import { findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function TgSimilarPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  const similar = await findSimilarSeoMovies(movie, 20);

  return (
    <div>
      <Link href={`/tg/watch/${movie.slug}`} className="mb-3 inline-flex text-sm font-bold text-[#ff4d55]">Назад к фильму</Link>
      <h1 className="text-2xl font-black">Похожие на {movie.titleRu}</h1>
      <div className="mt-4 space-y-3">
        {similar.map((item) => <TgMovieCard key={item.id} movie={item} />)}
      </div>
      {!similar.length ? <div className="mt-4 rounded-3xl border border-white/10 bg-white/[.04] p-5 text-[#a1a1aa]">Похожие фильмы скоро появятся.</div> : null}
    </div>
  );
}
