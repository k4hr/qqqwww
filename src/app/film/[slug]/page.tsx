import { notFound, permanentRedirect } from "next/navigation";
import { getSeoMovieByFilmSlug, getSeoMovieBySlug } from "@/lib/seo-pages";
import { watchPath } from "@/lib/seo-links";


export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export default async function FilmPage({ params }: Props) {
  const { slug } = await params;
  const movie = await getSeoMovieByFilmSlug(slug) ?? await getSeoMovieBySlug(slug);
  if (!movie) notFound();
  permanentRedirect(watchPath(movie));
}
