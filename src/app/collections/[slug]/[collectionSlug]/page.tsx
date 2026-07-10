import { notFound } from "next/navigation";
import { getCreatorCollectionMetadata, renderCreatorCollectionPage } from "@/lib/collaboration/public-pages";

export const revalidate = 900;

type Props = { params: Promise<{ slug: string; collectionSlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, collectionSlug } = await params;
  return (await getCreatorCollectionMetadata(slug, collectionSlug)) || {};
}

export default async function CreatorCollectionPublicPage({ params }: Props) {
  const { slug, collectionSlug } = await params;
  const page = await renderCreatorCollectionPage(slug, collectionSlug);
  if (!page) notFound();
  return page;
}
