import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { VibixPlayer } from "@/components/vibix-player";
import { TvFocusProvider } from "@/components/tv/tv-focus-provider";
import { TvCss, TvShell } from "@/components/tv/tv-ui";
import { getTvMovieBySlug, tvMoviePath, TV_REVALIDATE_SECONDS } from "@/lib/tv";

export const revalidate = TV_REVALIDATE_SECONDS;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getTvMovieBySlug((await params).slug);
  if (!movie) return {};
  return {
    title: `Смотреть ${movie.titleRu} — REDFILM TV`,
    robots: { index: false, follow: false },
  };
}

export default async function MsxPlayerPage({ params }: Props) {
  const movie = await getTvMovieBySlug((await params).slug);
  if (!movie) notFound();

  return (
    <TvShell>
      <TvCss />
      <TvFocusProvider />
      <div className="flex h-screen flex-col bg-black">
        <div className="z-20 flex h-24 items-center justify-between border-b border-white/10 bg-black/86 px-8">
          <Link data-tv-focus data-tv-autofocus href={tvMoviePath(movie)} className="tv-pill"><ArrowLeft size={22} /> Назад к фильму</Link>
          <div className="min-w-0 text-right">
            <p className="truncate text-2xl font-black">{movie.titleRu}</p>
            <p className="text-sm font-bold uppercase tracking-[.18em] text-[#ff4d55]">REDFILM TV</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-black">
          <VibixPlayer
            title={movie.titleRu}
            kinopoiskId={movie.kinopoiskId}
            imdbId={movie.imdbId}
            vibixId={movie.vibixId}
            vibixType={movie.vibixType}
            embedCode={movie.vibixEmbedCode}
            iframeUrl={movie.vibixIframeUrl}
            posterUrl={movie.posterUrl}
          />
        </div>
      </div>
    </TvShell>
  );
}
