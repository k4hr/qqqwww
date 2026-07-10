import { notFound } from "next/navigation";
import { getCreatorCollectionMetadata, renderCreatorCollectionPage } from "@/lib/collaboration/public-pages";

export const revalidate = 900;

type Props = { params: Promise<{ partnerSlug: string; collectionSlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { partnerSlug, collectionSlug } = await params;
  return (await getCreatorCollectionMetadata(partnerSlug, collectionSlug)) || {};
}

export default async function CreatorCollectionPublicPage({ params }: Props) {
  const { partnerSlug, collectionSlug } = await params;
  const page = await renderCreatorCollectionPage(partnerSlug, collectionSlug);
  if (!page) notFound();
  return page;
}
