import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchPage from "@/app/watch/[slug]/page";
import { resolveSeasonSeoPage, seasonSeoDescription, seasonSeoTitle } from "@/lib/seo/season-pages";
import { seasonPath } from "@/lib/seo-links";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await resolveSeasonSeoPage((await params).slug);
  if (!page) return {};

  const canonical = seasonPath(page.movie, page.season);
  const title = seasonSeoTitle(page);
  const description = seasonSeoDescription(page);
  const image = page.movie.backdropUrl || page.movie.posterUrl;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "video.tv_show",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function SeriesSeasonPage({ params }: Props) {
  const page = await resolveSeasonSeoPage((await params).slug);
  if (!page) notFound();

  // SEO alias only: keep /season/... indexed with seasonal metadata,
  // but render the existing /watch/[slug] page unchanged.
  return <WatchPage params={Promise.resolve({ slug: page.movie.slug })} />;
}
