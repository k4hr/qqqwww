import type { Metadata } from "next";
import Link from "next/link";
import { VibixPlayer, buildVibixAttrs, parseEmbedCode } from "@/components/vibix-player";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { siteUrl, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telegram Player Test — REDFILM",
  robots: { index: false, follow: false },
};

export default async function TgTestPlayerPage() {
  const movie = await prisma.movie.findFirst({
    where: vibixPublicMovieWhere,
    orderBy: [{ vibixEmbedCode: "desc" }, { homeScore: "desc" }, { createdAt: "desc" }],
  });

  if (!movie) {
    return <div className="container py-8 text-white"><div className="mf-panel p-5">Нет публичного фильма для теста.</div></div>;
  }

  const attrs = buildVibixAttrs({ kinopoiskId: movie.kinopoiskId, imdbId: movie.imdbId, embedCode: movie.vibixEmbedCode });
  const parsed = parseEmbedCode(movie.vibixEmbedCode);
  const mode = attrs ? "rendex-ins" : movie.vibixIframeUrl ? "iframe-fallback" : "missing";

  return (
    <div className="container py-8 text-white">
      <section className="mf-panel p-5">
        <h1 className="text-2xl font-black">Telegram Player Test</h1>
        <p className="mt-2 text-[#a1a1aa]">{movie.titleRu} ({movie.year})</p>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black">
          <VibixPlayer
            title={movie.titleRu}
            kinopoiskId={movie.kinopoiskId}
            imdbId={movie.imdbId}
            embedCode={movie.vibixEmbedCode}
            iframeUrl={movie.vibixIframeUrl}
            posterUrl={movie.posterUrl}
          />
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-4 font-mono text-xs text-[#d7d7dd]">
          <div>mode: {mode}</div>
          <div>hasEmbedCode: {String(Boolean(movie.vibixEmbedCode?.trim()))}</div>
          <div>hasIframeUrl: {String(Boolean(movie.vibixIframeUrl?.trim()))}</div>
          <div>kinopoiskId: {movie.kinopoiskId || "none"}</div>
          <div>imdbId: {movie.imdbId || "none"}</div>
          <div>publisherId: {attrs?.["data-publisher-id"] || parsed["data-publisher-id"] || "678353780"}</div>
        </div>
        <Link href={siteUrl(watchPath(movie))} className="mf-btn mf-btn-primary mt-5">Открыть публичную страницу</Link>
      </section>
    </div>
  );
}
