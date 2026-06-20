import { notFound, permanentRedirect } from "next/navigation";
import { getSeoMovieBySlug } from "@/lib/seo-pages";
import { watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export default async function LegacyMoviePage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  permanentRedirect(watchPath(movie));
}
