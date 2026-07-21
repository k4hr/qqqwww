import "server-only";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

type CollaborationDb = Prisma.TransactionClient;

type SyncCollectionLinkInput = {
  partnerId: string;
  partnerSlug: string;
  collectionId: string;
  collectionSlug: string;
  title: string;
  isActive: boolean;
};

export async function syncCreatorHubVisibility(
  db: CollaborationDb,
  input: { hubId: string; partnerIsActive: boolean },
) {
  const publishedCount = await db.creatorCollection.count({
    where: { hubId: input.hubId, status: "PUBLISHED" },
  });

  await db.creatorHub.update({
    where: { id: input.hubId },
    data: {
      isPublished: input.partnerIsActive && publishedCount > 0,
    },
  });

  return publishedCount;
}

/**
 * Keeps the referral link for a collection in sync with its public URL.
 *
 * Historical data can contain a missing link, a link with an old slug, or
 * duplicate links that point to the same collection. Publication must not fail
 * because of those inconsistencies, so this function repairs them in-place.
 */
export async function syncCollectionPartnerLink(
  db: CollaborationDb,
  input: SyncCollectionLinkInput,
) {
  const targetUrl = `/collections/${input.partnerSlug}/${input.collectionSlug}`;
  let existingByCollection = await db.partnerLink.findFirst({
    where: {
      partnerId: input.partnerId,
      collectionId: input.collectionId,
    },
    orderBy: { createdAt: "asc" },
  });

  let linkSlug = input.collectionSlug;
  let slugOwner = await db.partnerLink.findUnique({
    where: { partnerId_slug: { partnerId: input.partnerId, slug: linkSlug } },
  });

  // Prefer the link that already owns the desired slug when it belongs to the
  // same collection. This avoids a unique-key failure if historical data has
  // duplicate links for one collection.
  if (slugOwner?.collectionId === input.collectionId) {
    existingByCollection = slugOwner;
  }

  // A manually-created referral link can already reserve the collection slug.
  // Keep the public collection URL unchanged and choose a safe internal slug
  // instead of aborting publication with a unique-key error.
  if (
    slugOwner &&
    slugOwner.id !== existingByCollection?.id &&
    slugOwner.collectionId !== input.collectionId
  ) {
    const base = `${input.collectionSlug}-${input.collectionId.slice(-6)}`;
    linkSlug = base;
    let suffix = 2;

    while (true) {
      const owner = await db.partnerLink.findUnique({
        where: { partnerId_slug: { partnerId: input.partnerId, slug: linkSlug } },
      });
      if (!owner || owner.id === existingByCollection?.id || owner.collectionId === input.collectionId) {
        slugOwner = owner;
        break;
      }
      linkSlug = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  let linkId: string;

  if (existingByCollection) {
    const updated = await db.partnerLink.update({
      where: { id: existingByCollection.id },
      data: {
        name: input.title,
        slug: linkSlug,
        targetType: "COLLECTION",
        targetUrl,
        collectionId: input.collectionId,
        movieId: null,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    linkId = updated.id;
  } else if (slugOwner && (!slugOwner.collectionId || slugOwner.collectionId === input.collectionId)) {
    const updated = await db.partnerLink.update({
      where: { id: slugOwner.id },
      data: {
        name: input.title,
        targetType: "COLLECTION",
        targetUrl,
        collectionId: input.collectionId,
        movieId: null,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    linkId = updated.id;
  } else {
    const created = await db.partnerLink.create({
      data: {
        partnerId: input.partnerId,
        name: input.title,
        slug: linkSlug,
        targetType: "COLLECTION",
        targetUrl,
        collectionId: input.collectionId,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    linkId = created.id;
  }

  // Disable stale duplicates left by earlier versions of the publication code.
  await db.partnerLink.updateMany({
    where: {
      partnerId: input.partnerId,
      collectionId: input.collectionId,
      id: { not: linkId },
    },
    data: { isActive: false },
  });

  return linkId;
}

export function revalidateCollectionPublication(input: {
  hubSlug: string;
  collectionSlug?: string | null;
  previousCollectionSlug?: string | null;
  collectionId?: string | null;
}) {
  const paths = new Set<string>([
    "/collections",
    `/collections/${input.hubSlug}`,
    "/sitemaps/collections.xml",
    "/admin/collaboration",
    "/admin/collaboration/collections",
    "/partner",
    "/partner/collections",
  ]);

  if (input.collectionSlug) {
    paths.add(`/collections/${input.hubSlug}/${input.collectionSlug}`);
  }

  if (input.previousCollectionSlug && input.previousCollectionSlug !== input.collectionSlug) {
    paths.add(`/collections/${input.hubSlug}/${input.previousCollectionSlug}`);
  }

  if (input.collectionId) {
    paths.add(`/partner/collections/${input.collectionId}`);
  }

  for (const path of paths) revalidatePath(path);

  // Also invalidate any previously cached dynamic/404 variants.
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/collections/[slug]/[collectionSlug]", "page");
}
