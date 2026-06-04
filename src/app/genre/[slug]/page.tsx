import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const genre = await prisma.genre.findUnique({ where: { slug } });
  if (!genre) return {};
  return {
    title: `${genre.name} смотреть онлайн — REDFILM`,
    description: `Фильмы и сериалы в жанре ${genre.name} в каталоге REDFILM.`,
  };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const genre = await prisma.genre.findUnique({ where: { slug } });
  if (!genre) notFound();

  return <ListPage title={`${genre.name} смотреть онлайн`} genreSlug={slug} sort={sort} />;
}
