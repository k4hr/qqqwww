import Image from "next/image";
import Link from "next/link";
import type { ContentType } from "@prisma/client";
import { getContentTypeLabel } from "@/lib/content";

type Props = {
  movie: {
    id: string;
    slug: string;
    titleRu: string;
    titleOriginal?: string | null;
    year: number;
    type: ContentType;
    posterUrl?: string | null;
    quality?: string | null;
    kpRating?: number | null;
    imdbRating?: number | null;
  };
};

export function TgMovieCard({ movie }: Props) {
  const rating = movie.kpRating ?? movie.imdbRating;
  return (
<<<<<<< HEAD
    <Link href={`/watch/${movie.slug}`} className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-3xl border border-white/10 bg-white/[.045] p-3 transition active:scale-[.99]">
=======
    <Link href={`/tg/watch/${movie.slug}`} className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-3xl border border-white/10 bg-white/[.045] p-3 transition active:scale-[.99]">
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#15151d]">
        {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill sizes="82px" className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-2xl font-black text-[#3f3f49]">R</div>}
      </div>
      <div className="min-w-0 py-1">
        <h3 className="line-clamp-2 text-base font-black leading-tight text-white">{movie.titleRu}</h3>
        <p className="mt-1 text-xs text-[#8f8f9a]">{getContentTypeLabel(movie.type)} · {movie.year}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-[#e50914] px-2 py-1 text-white">{movie.quality || "HD"}</span>
          {rating ? <span className="rounded-full bg-white/10 px-2 py-1 text-[#ffd166]">{rating.toFixed(1)}</span> : null}
        </div>
        <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-[#09090d]">Смотреть</span>
      </div>
    </Link>
  );
}
