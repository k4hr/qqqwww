import { notFound, permanentRedirect } from "next/navigation";
import { getSeoMovieBySlug } from "@/lib/seo-pages";
import { filmPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export default async function LegacyFilmPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  permanentRedirect(filmPath(movie));
}
