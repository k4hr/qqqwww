"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  clearPartnerSession,
  createPartnerSession,
  getRequestFingerprint,
  requirePartnerSession,
} from "@/lib/collaboration/auth";
import { clampNumber, readText, verifyPassword } from "@/lib/collaboration/security";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import {
  revalidateCollectionPublication,
  syncCreatorHubVisibility,
  syncCollectionPartnerLink,
} from "@/lib/collaboration/collection-publication";

function partnerPaths() {
  return [
    "/partner",
    "/partner/links",
    "/partner/collections",
    "/partner/statistics",
    "/partner/revenue",
    "/partner/payouts",
    "/partner/settings",
  ];
}

function refreshPartner() {
  for (const path of partnerPaths()) revalidatePath(path);
}

async function uniqueCollectionSlug(
  hubId: string,
  partnerId: string,
  title: string,
  excludeId?: string,
) {
  const base = slugify(title) || "podborka";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const [collection, link] = await Promise.all([
      prisma.creatorCollection.findFirst({
        where: {
          hubId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
      prisma.partnerLink.findUnique({
        where: { partnerId_slug: { partnerId, slug: candidate } },
        select: { id: true, collectionId: true },
      }),
    ]);

    // A link that already belongs to the same collection is not a conflict.
    if (!collection && (!link || link.collectionId === excludeId)) return candidate;

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function getOrCreatePartnerHub(partner: {
  id: string;
  slug: string;
  publicName: string | null;
  name: string;
  description: string | null;
  coverUrl: string | null;
}) {
  const existing = await prisma.creatorHub.findUnique({ where: { partnerId: partner.id } });
  if (existing) return existing;

  return prisma.creatorHub.create({
    data: {
      partnerId: partner.id,
      slug: partner.slug,
      title: `Подборки ${partner.publicName || partner.name}`,
      description: partner.description,
      coverUrl: partner.coverUrl,
      isPublished: false,
    },
  });
}

async function countPublishableMovies(collectionId: string) {
  const items = await prisma.creatorCollectionMovie.findMany({
    where: { collectionId },
    select: { movieId: true },
  });

  if (!items.length) return 0;

  return prisma.movie.count({
    where: {
      AND: [
        vibixPublicMovieWhere,
        { id: { in: items.map((item) => item.movieId) } },
      ],
    },
  });
}

function collectionStatusAfterPartnerEdit(
  currentStatus: string,
  requireModeration: boolean,
) {
  if (currentStatus === "REJECTED") return "DRAFT" as const;
  if (currentStatus === "PUBLISHED" && requireModeration) {
    return "PENDING_REVIEW" as const;
  }
  return currentStatus as "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
}

export async function partnerLogin(formData: FormData) {
  const login = readText(formData, "login", 80).toLowerCase();
  const password = readText(formData, "password", 200);
  const fingerprint = await getRequestFingerprint();
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const attempts = await prisma.partnerLoginAttempt.count({
    where: { login, success: false, createdAt: { gte: since } },
  });
  if (attempts >= 8) redirect("/partner/login?error=rate");

  const partner = await prisma.partner.findUnique({ where: { login } });
  const ok = Boolean(
    partner &&
      partner.status === "ACTIVE" &&
      verifyPassword(password, partner.passwordHash),
  );
  await prisma.partnerLoginAttempt
    .create({ data: { login, ipHash: fingerprint.ipHash, success: ok } })
    .catch(() => undefined);
  if (!partner || !ok) redirect("/partner/login?error=invalid");

  await prisma.$transaction([
    prisma.partner.update({
      where: { id: partner.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.partnerSession.deleteMany({
      where: { partnerId: partner.id, expiresAt: { lt: new Date() } },
    }),
  ]);
  await createPartnerSession(partner.id);
  redirect("/partner");
}

export async function partnerLogout() {
  await clearPartnerSession();
  redirect("/partner/login?logout=1");
}

export async function partnerCreateCollection(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const hub = await getOrCreatePartnerHub(partner);
  const title = readText(formData, "title", 160);
  if (!title) redirect("/partner/collections/new?error=required");

  const slug = await uniqueCollectionSlug(hub.id, partner.id, title);
  const lastCollection = await prisma.creatorCollection.findFirst({
    where: { hubId: hub.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const collection = await prisma.$transaction(async (tx) => {
    // A new collection is always a draft because it has no movies yet. The
    // explicit publication button becomes available after content is added.
    const created = await tx.creatorCollection.create({
      data: {
        hubId: hub.id,
        partnerId: partner.id,
        title,
        slug,
        description: readText(formData, "description", 1000) || null,
        position: (lastCollection?.position ?? -1) + 1,
        status: "DRAFT",
      },
    });

    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: created.id,
      collectionSlug: created.slug,
      title: created.title,
      isActive: false,
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });

    return created;
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(`/partner/collections/${collection.id}?created=1`);
}

export async function partnerUpdateCollection(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const id = readText(formData, "id");
  const collection = id
    ? await prisma.creatorCollection.findUnique({ where: { id } })
    : null;
  if (!collection || collection.partnerId !== partner.id) {
    redirect("/partner/collections?error=not_found");
  }

  const hub = await prisma.creatorHub.findUnique({ where: { id: collection.hubId } });
  if (!hub) redirect("/partner/collections?error=hub");

  const title = readText(formData, "title", 160);
  if (!title) redirect(`/partner/collections/${id}?error=required`);

  const slug = await uniqueCollectionSlug(
    collection.hubId,
    partner.id,
    title,
    collection.id,
  );
  const nextStatus = collectionStatusAfterPartnerEdit(
    collection.status,
    partner.requireCollectionModeration,
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.creatorCollection.update({
      where: { id },
      data: {
        title,
        slug,
        description: readText(formData, "description", 1000) || null,
        status: nextStatus,
        moderationComment: collection.status === "REJECTED" ? null : collection.moderationComment,
        submittedAt:
          nextStatus === "PENDING_REVIEW" ? now : collection.submittedAt,
        publishedAt: nextStatus === "PUBLISHED" ? collection.publishedAt ?? now : null,
      },
    });

    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: id,
      collectionSlug: slug,
      title,
      isActive: nextStatus === "PUBLISHED",
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: slug,
    previousCollectionSlug: collection.slug,
    collectionId: id,
  });
  redirect(`/partner/collections/${id}?saved=1`);
}

export async function partnerSubmitCollection(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const id = readText(formData, "id");
  const collection = id
    ? await prisma.creatorCollection.findUnique({ where: { id } })
    : null;
  if (!collection || collection.partnerId !== partner.id) {
    redirect("/partner/collections?error=not_found");
  }

  const hub = await prisma.creatorHub.findUnique({ where: { id: collection.hubId } });
  if (!hub) redirect(`/partner/collections/${id}?error=hub`);

  const publishableMovies = await countPublishableMovies(collection.id);
  if (publishableMovies < 1) {
    redirect(`/partner/collections/${id}?error=empty_collection`);
  }

  // An already approved collection can use this action to repair a stale
  // hidden hub/link without being sent through moderation a second time.
  const status = collection.status === "PUBLISHED"
    ? "PUBLISHED"
    : partner.requireCollectionModeration
      ? "PENDING_REVIEW"
      : "PUBLISHED";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.creatorCollection.update({
      where: { id },
      data: {
        status,
        moderationComment: null,
        submittedAt: now,
        publishedAt: status === "PUBLISHED" ? now : null,
      },
    });

    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: collection.id,
      collectionSlug: collection.slug,
      title: collection.title,
      isActive: status === "PUBLISHED",
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(
    `/partner/collections/${id}?${status === "PUBLISHED" ? "published" : "submitted"}=1`,
  );
}

export async function partnerAddMovie(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const collectionId = readText(formData, "collectionId");
  const movieId = readText(formData, "movieId");
  const collection = collectionId
    ? await prisma.creatorCollection.findUnique({ where: { id: collectionId } })
    : null;
  if (!collection || collection.partnerId !== partner.id) {
    redirect("/partner/collections?error=not_found");
  }

  const hub = await prisma.creatorHub.findUnique({ where: { id: collection.hubId } });
  if (!hub) redirect(`/partner/collections/${collectionId}?error=hub`);

  const movie = movieId
    ? await prisma.movie.findFirst({
        where: { AND: [vibixPublicMovieWhere, { id: movieId }] },
        select: { id: true },
      })
    : null;
  if (!movie) {
    redirect(`/partner/collections/${collectionId}?error=movie_not_public`);
  }

  const last = await prisma.creatorCollectionMovie.findFirst({
    where: { collectionId },
    orderBy: { position: "desc" },
  });
  const nextStatus = collectionStatusAfterPartnerEdit(
    collection.status,
    partner.requireCollectionModeration,
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.creatorCollectionMovie.upsert({
      where: { collectionId_movieId: { collectionId, movieId } },
      update: {
        authorComment:
          readText(formData, "authorComment", 1000) || undefined,
      },
      create: {
        collectionId,
        movieId,
        position: (last?.position ?? -1) + 1,
        authorComment: readText(formData, "authorComment", 1000) || null,
      },
    });

    if (nextStatus !== collection.status) {
      await tx.creatorCollection.update({
        where: { id: collection.id },
        data: {
          status: nextStatus,
          submittedAt: nextStatus === "PENDING_REVIEW" ? now : collection.submittedAt,
          publishedAt: nextStatus === "PUBLISHED" ? collection.publishedAt ?? now : null,
        },
      });
    }

    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: collection.id,
      collectionSlug: collection.slug,
      title: collection.title,
      isActive: nextStatus === "PUBLISHED",
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(`/partner/collections/${collectionId}?added=1`);
}

export async function partnerRemoveMovie(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const id = readText(formData, "id");
  const item = id
    ? await prisma.creatorCollectionMovie.findUnique({ where: { id } })
    : null;
  const collection = item
    ? await prisma.creatorCollection.findUnique({ where: { id: item.collectionId } })
    : null;
  if (!item || !collection || collection.partnerId !== partner.id) {
    redirect("/partner/collections?error=not_found");
  }

  const hub = await prisma.creatorHub.findUnique({ where: { id: collection.hubId } });
  if (!hub) redirect(`/partner/collections/${collection.id}?error=hub`);

  const remainingCount = await prisma.creatorCollectionMovie.count({
    where: { collectionId: collection.id, id: { not: item.id } },
  });
  let nextStatus = collectionStatusAfterPartnerEdit(
    collection.status,
    partner.requireCollectionModeration,
  );
  if (remainingCount < 1) nextStatus = "DRAFT";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.creatorCollectionMovie.delete({ where: { id } });
    await tx.creatorCollection.update({
      where: { id: collection.id },
      data: {
        status: nextStatus,
        submittedAt: nextStatus === "PENDING_REVIEW" ? now : collection.submittedAt,
        publishedAt: nextStatus === "PUBLISHED" ? collection.publishedAt ?? now : null,
      },
    });
    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: collection.id,
      collectionSlug: collection.slug,
      title: collection.title,
      isActive: nextStatus === "PUBLISHED",
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(`/partner/collections/${collection.id}?removed=1`);
}

export async function partnerReorderMovies(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (!partner.canManageCollections) {
    redirect("/partner/collections?error=forbidden");
  }

  const collectionId = readText(formData, "collectionId");
  const collection = collectionId
    ? await prisma.creatorCollection.findUnique({ where: { id: collectionId } })
    : null;
  if (!collection || collection.partnerId !== partner.id) {
    redirect("/partner/collections?error=not_found");
  }

  const hub = await prisma.creatorHub.findUnique({ where: { id: collection.hubId } });
  if (!hub) redirect(`/partner/collections/${collectionId}?error=hub`);

  const removeId = readText(formData, "removeId");
  if (removeId) {
    const item = await prisma.creatorCollectionMovie.findFirst({
      where: { id: removeId, collectionId },
      select: { id: true },
    });
    if (!item) redirect(`/partner/collections/${collectionId}?error=item_not_found`);

    const remainingCount = await prisma.creatorCollectionMovie.count({
      where: { collectionId, id: { not: removeId } },
    });
    let nextStatus = collectionStatusAfterPartnerEdit(
      collection.status,
      partner.requireCollectionModeration,
    );
    if (remainingCount < 1) nextStatus = "DRAFT";
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.creatorCollectionMovie.delete({ where: { id: removeId } });
      await tx.creatorCollection.update({
        where: { id: collection.id },
        data: {
          status: nextStatus,
          submittedAt: nextStatus === "PENDING_REVIEW" ? now : collection.submittedAt,
          publishedAt: nextStatus === "PUBLISHED" ? collection.publishedAt ?? now : null,
        },
      });
      await syncCollectionPartnerLink(tx, {
        partnerId: partner.id,
        partnerSlug: hub.slug,
        collectionId: collection.id,
        collectionSlug: collection.slug,
        title: collection.title,
        isActive: nextStatus === "PUBLISHED",
      });

      await syncCreatorHubVisibility(tx, {
        hubId: hub.id,
        partnerIsActive: true,
      });
    });

    refreshPartner();
    revalidateCollectionPublication({
      hubSlug: hub.slug,
      collectionSlug: collection.slug,
      collectionId: collection.id,
    });
    redirect(`/partner/collections/${collectionId}?removed=1`);
  }

  const updates: Array<{
    id: string;
    position: number;
    authorComment: string | null;
  }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("position:") || typeof value !== "string") continue;
    const id = key.slice("position:".length);
    updates.push({
      id,
      position: Math.floor(clampNumber(value, 0, 0, 10_000)),
      authorComment: readText(formData, `comment:${id}`, 1000) || null,
    });
  }

  const nextStatus = collectionStatusAfterPartnerEdit(
    collection.status,
    partner.requireCollectionModeration,
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.creatorCollectionMovie.updateMany({
        where: { id: update.id, collectionId },
        data: {
          position: update.position,
          authorComment: update.authorComment,
        },
      });
    }

    if (nextStatus !== collection.status) {
      await tx.creatorCollection.update({
        where: { id: collection.id },
        data: {
          status: nextStatus,
          submittedAt: nextStatus === "PENDING_REVIEW" ? now : collection.submittedAt,
          publishedAt: nextStatus === "PUBLISHED" ? collection.publishedAt ?? now : null,
        },
      });
    }

    await syncCollectionPartnerLink(tx, {
      partnerId: partner.id,
      partnerSlug: hub.slug,
      collectionId: collection.id,
      collectionSlug: collection.slug,
      title: collection.title,
      isActive: nextStatus === "PUBLISHED",
    });

    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: true,
    });
  });

  refreshPartner();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(`/partner/collections/${collectionId}?ordered=1`);
}
