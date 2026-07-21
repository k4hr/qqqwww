"use server";

import { Prisma, type CreatorCollectionStatus, type PartnerAttributionModel, type PartnerLinkTargetType, type PartnerPayoutStatus, type PartnerRevenuePeriodType, type PartnerStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { calculateGrossRevenue, calculatePartnerCommission, getCurrentMonetizationRate } from "@/lib/collaboration/revenue";
import { clampNumber, hashPassword, randomToken, readBool, readText } from "@/lib/collaboration/security";
import { readImageDataUrl } from "@/lib/collaboration/image-upload";
import {
  revalidateCollectionPublication,
  syncCreatorHubVisibility,
  syncCollectionPartnerLink,
} from "@/lib/collaboration/collection-publication";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

const ADMIN_COLLAB_PATHS = ["/admin/collaboration", "/admin/collaboration/partners", "/admin/collaboration/collections", "/admin/collaboration/revenue", "/admin/collaboration/payouts", "/admin/collaboration/settings"];

function refreshAdmin() {
  for (const path of ADMIN_COLLAB_PATHS) revalidatePath(path);
}

function decimal(value: unknown, fallback = "0") {
  try {
    return new Prisma.Decimal(String(value ?? fallback).replace(",", "."));
  } catch {
    return new Prisma.Decimal(fallback);
  }
}

function validStatus(value: string): PartnerStatus {
  return ["ACTIVE", "PAUSED", "BLOCKED"].includes(value) ? value as PartnerStatus : "ACTIVE";
}

function validAttributionModel(value: string): PartnerAttributionModel {
  return value === "LAST_CLICK" ? "LAST_CLICK" : "FIRST_CLICK_LOCKED";
}

function validTargetType(value: string): PartnerLinkTargetType {
  return ["AUTHOR_HUB", "COLLECTION", "MOVIE", "HOME", "CUSTOM"].includes(value) ? value as PartnerLinkTargetType : "AUTHOR_HUB";
}

function validCollectionStatus(value: string): CreatorCollectionStatus {
  return ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"].includes(value) ? value as CreatorCollectionStatus : "DRAFT";
}

function validPeriodType(value: string): PartnerRevenuePeriodType {
  return ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"].includes(value) ? value as PartnerRevenuePeriodType : "CUSTOM";
}

function validPayoutStatus(value: string): PartnerPayoutStatus {
  return ["PENDING", "APPROVED", "PAID", "CANCELLED"].includes(value) ? value as PartnerPayoutStatus : "PENDING";
}

export async function adminCreatePartner(formData: FormData) {
  const name = readText(formData, "name", 120);
  const login = readText(formData, "login", 80).toLowerCase();
  const rawSlug = readText(formData, "slug", 90) || login || name;
  const slug = slugify(rawSlug);
  const password = readText(formData, "password", 120) || randomToken(10);
  const commissionPercent = decimal(clampNumber(readText(formData, "commissionPercent"), 30, 0, 100));
  const attributionDays = Math.floor(clampNumber(readText(formData, "attributionDays"), 30, 1, 365));

  if (!name || !login || !slug || password.length < 8) redirect("/admin/collaboration/partners?error=required");

  const publicName = readText(formData, "publicName", 120);
  const avatarUrl = await readImageDataUrl(formData, "avatarImage");
  const coverUrl = await readImageDataUrl(formData, "coverImage");
  const partner = await prisma.partner.create({
    data: {
      name,
      publicName: publicName || null,
      cabinetTitle: readText(formData, "cabinetTitle", 160) || null,
      slug,
      login,
      passwordHash: hashPassword(password),
      email: readText(formData, "email", 200) || null,
      avatarUrl,
      coverUrl,
      description: readText(formData, "description", 2000) || null,
      commissionPercent,
      attributionDays,
      attributionModel: validAttributionModel(readText(formData, "attributionModel")),
      status: validStatus(readText(formData, "status")),
      canManageCollections: readBool(formData, "canManageCollections", true),
      requireCollectionModeration: readBool(formData, "requireCollectionModeration", true),
      showFinancials: readBool(formData, "showFinancials", true),
      adminComment: readText(formData, "adminComment", 2000) || null,
    },
  });

  const hub = await prisma.creatorHub.create({
    data: {
      partnerId: partner.id,
      slug: partner.slug,
      title: `Подборки ${partner.publicName || partner.name}`,
      description: partner.description,
      coverUrl: partner.coverUrl,
      // A hub becomes public together with its first published collection.
      isPublished: false,
    },
  });

  await prisma.$transaction([
    prisma.partnerCommissionRate.create({ data: { partnerId: partner.id, percent: commissionPercent, effectiveFrom: new Date(), createdBy: "admin" } }),
    prisma.partnerLink.create({
      data: {
        partnerId: partner.id,
        name: "Основная ссылка",
        slug: partner.slug,
        targetType: "AUTHOR_HUB",
        targetUrl: `/collections/${partner.slug}`,
        isActive: true,
      },
    }),
  ]);

  refreshAdmin();
  redirect(`/admin/collaboration/partners?created=${encodeURIComponent(partner.login)}&password=${encodeURIComponent(password)}`);
}

export async function adminUpdatePartner(formData: FormData) {
  const id = readText(formData, "id");
  if (!id) redirect("/admin/collaboration/partners?error=id");

  const existing = await prisma.partner.findUnique({
    where: { id },
    select: { avatarUrl: true, coverUrl: true, login: true, slug: true },
  });
  if (!existing) redirect("/admin/collaboration/partners?error=id");

  const name = readText(formData, "name", 120);
  const publicName = readText(formData, "publicName", 120);
  const login = readText(formData, "login", 80).trim().toLowerCase();
  const slug = slugify(readText(formData, "slug", 90));
  if (!name || !login || !slug) redirect("/admin/collaboration/partners?error=required");

  const [loginOwner, slugOwner] = await Promise.all([
    prisma.partner.findFirst({ where: { login, id: { not: id } }, select: { id: true } }),
    prisma.partner.findFirst({ where: { slug, id: { not: id } }, select: { id: true } }),
  ]);
  if (loginOwner) redirect("/admin/collaboration/partners?error=login_taken");
  if (slugOwner) redirect("/admin/collaboration/partners?error=slug_taken");

  const avatarUrl = await readImageDataUrl(formData, "avatarImage", existing.avatarUrl);
  const coverUrl = await readImageDataUrl(formData, "coverImage", existing.coverUrl);
  const description = readText(formData, "description", 2000) || null;
  const status = validStatus(readText(formData, "status"));

  await prisma.$transaction([
    prisma.partner.update({
      where: { id },
      data: {
        name,
        publicName: publicName || null,
        cabinetTitle: readText(formData, "cabinetTitle", 160) || null,
        slug,
        login,
        email: readText(formData, "email", 200) || null,
        avatarUrl,
        coverUrl,
        description,
        attributionDays: Math.floor(clampNumber(readText(formData, "attributionDays"), 30, 1, 365)),
        attributionModel: validAttributionModel(readText(formData, "attributionModel")),
        status,
        canManageCollections: readBool(formData, "canManageCollections", true),
        requireCollectionModeration: readBool(formData, "requireCollectionModeration", true),
        showFinancials: readBool(formData, "showFinancials", true),
        linksBlocked: readBool(formData, "linksBlocked", false),
        adminComment: readText(formData, "adminComment", 2000) || null,
      },
    }),
    prisma.creatorHub.updateMany({
      where: { partnerId: id },
      data: {
        slug,
        title: `Подборки ${publicName || name}`,
        description,
        coverUrl,
      },
    }),
    prisma.partnerLink.updateMany({
      where: { partnerId: id, targetType: "AUTHOR_HUB" },
      data: { targetUrl: `/collections/${slug}` },
    }),
  ]);

  const updatedHub = await prisma.creatorHub.findUnique({ where: { partnerId: id } });
  if (updatedHub) {
    const publishedCount = await prisma.creatorCollection.count({
      where: { hubId: updatedHub.id, status: "PUBLISHED" },
    });
    await prisma.creatorHub.update({
      where: { id: updatedHub.id },
      data: { isPublished: status === "ACTIVE" && publishedCount > 0 },
    });
    revalidateCollectionPublication({
      hubSlug: updatedHub.slug,
    });
  }

  // Collection link targets contain the partner slug, so refresh them after a slug change.
  if (existing.slug !== slug) {
    const collectionLinks = await prisma.partnerLink.findMany({
      where: { partnerId: id, targetType: "COLLECTION" },
      select: { id: true, collectionId: true },
    });
    if (collectionLinks.length) {
      const collectionIds = collectionLinks.flatMap((link) =>
        link.collectionId ? [link.collectionId] : [],
      );
      const collections = collectionIds.length
        ? await prisma.creatorCollection.findMany({
            where: { id: { in: collectionIds } },
            select: { id: true, slug: true },
          })
        : [];
      const collectionById = new Map(
        collections.map((collection) => [collection.id, collection]),
      );

      await prisma.$transaction(
        collectionLinks.flatMap((link) => {
          const collection = link.collectionId
            ? collectionById.get(link.collectionId)
            : null;
          return collection
            ? [prisma.partnerLink.update({
            where: { id: link.id },
                data: { targetUrl: `/collections/${slug}/${collection.slug}` },
              })]
            : [];
        }),
      );
    }
  }

  refreshAdmin();
  revalidatePath("/collections");
  revalidatePath(`/collections/${existing.slug}`);
  revalidatePath(`/collections/${slug}`);
  redirect(`/admin/collaboration/partners?updated=1&login=${encodeURIComponent(login)}&slug=${encodeURIComponent(slug)}`);
}

export async function adminChangePartnerCommission(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  const percent = decimal(clampNumber(readText(formData, "percent"), 30, 0, 100));
  if (!partnerId) redirect("/admin/collaboration/partners?error=partner");
  const now = new Date();
  await prisma.$transaction([
    prisma.partnerCommissionRate.updateMany({ where: { partnerId, effectiveTo: null }, data: { effectiveTo: now } }),
    prisma.partnerCommissionRate.create({ data: { partnerId, percent, effectiveFrom: now, createdBy: "admin" } }),
    prisma.partner.update({ where: { id: partnerId }, data: { commissionPercent: percent } }),
  ]);
  refreshAdmin();
  redirect("/admin/collaboration/partners?commission=1");
}

export async function adminResetPartnerPassword(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  if (!partnerId) redirect("/admin/collaboration/partners?error=partner");
  const password = readText(formData, "password", 120) || randomToken(10);
  await prisma.$transaction([
    prisma.partner.update({ where: { id: partnerId }, data: { passwordHash: hashPassword(password) } }),
    prisma.partnerSession.deleteMany({ where: { partnerId } }),
  ]);
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { login: true } });
  refreshAdmin();
  redirect(`/admin/collaboration/partners?created=${encodeURIComponent(partner?.login || "")}&password=${encodeURIComponent(password)}`);
}

export async function adminSetPartnerStatus(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  const status = validStatus(readText(formData, "status"));
  if (!partnerId) redirect("/admin/collaboration/partners?error=partner");
  await prisma.partner.update({ where: { id: partnerId }, data: { status } });
  const hub = await prisma.creatorHub.findUnique({ where: { partnerId } });
  if (hub) {
    const publishedCount = await prisma.creatorCollection.count({
      where: { hubId: hub.id, status: "PUBLISHED" },
    });
    await prisma.creatorHub.update({
      where: { id: hub.id },
      data: { isPublished: status === "ACTIVE" && publishedCount > 0 },
    });
    revalidateCollectionPublication({
      hubSlug: hub.slug,
    });
  }
  refreshAdmin();
  redirect("/admin/collaboration/partners?status=1");
}

export async function adminEndPartnerAttributions(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  if (!partnerId) redirect("/admin/collaboration/partners?error=partner");
  await prisma.partnerAttribution.updateMany({ where: { partnerId, isActive: true }, data: { isActive: false, expiresAt: new Date() } });
  refreshAdmin();
  redirect("/admin/collaboration/partners?attributions=ended");
}

export async function adminCreatePartnerLink(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  const name = readText(formData, "name", 120);
  const slug = slugify(readText(formData, "slug", 120) || name);
  if (!partnerId || !name || !slug) redirect("/admin/collaboration/links?error=required");
  await prisma.partnerLink.create({
    data: {
      partnerId,
      name,
      slug,
      source: readText(formData, "source", 80) || null,
      targetType: validTargetType(readText(formData, "targetType")),
      targetUrl: readText(formData, "targetUrl", 500) || null,
      collectionId: readText(formData, "collectionId") || null,
      movieId: readText(formData, "movieId") || null,
      isActive: readBool(formData, "isActive", true),
    },
  });
  refreshAdmin();
  redirect("/admin/collaboration/links?created=1");
}

export async function adminUpdateCreatorHubPosition(formData: FormData) {
  const id = readText(formData, "id");
  const rawPosition = Number(readText(formData, "position"));
  const position = Number.isFinite(rawPosition) ? Math.max(0, Math.floor(rawPosition)) : 0;

  if (!id) redirect("/admin/collaboration/collections?error=hub-id");

  await prisma.creatorHub.update({
    where: { id },
    data: { position },
  });

  refreshAdmin();
  revalidatePath("/collections");
  redirect("/admin/collaboration/collections?order=saved");
}

export async function adminModerateCollection(formData: FormData) {
  const id = readText(formData, "id");
  const status = validCollectionStatus(readText(formData, "status"));
  if (!id) redirect("/admin/collaboration/collections?error=id");

  const collection = await prisma.creatorCollection.findUnique({ where: { id } });
  if (!collection) redirect("/admin/collaboration/collections?error=not_found");

  const [hub, partner, items] = await Promise.all([
    prisma.creatorHub.findUnique({ where: { id: collection.hubId } }),
    prisma.partner.findUnique({ where: { id: collection.partnerId } }),
    prisma.creatorCollectionMovie.findMany({
      where: { collectionId: collection.id },
      select: { movieId: true },
    }),
  ]);

  if (!hub || !partner) redirect("/admin/collaboration/collections?error=broken_relation");
  if (status === "PUBLISHED" && partner.status !== "ACTIVE") {
    redirect("/admin/collaboration/collections?error=partner_inactive");
  }
  const publishableMovieCount = items.length
    ? await prisma.movie.count({
        where: {
          AND: [
            vibixPublicMovieWhere,
            { id: { in: items.map((item) => item.movieId) } },
          ],
        },
      })
    : 0;
  if (status === "PUBLISHED" && publishableMovieCount < 1) {
    redirect("/admin/collaboration/collections?error=empty_collection");
  }

  const now = new Date();
  const moderationComment = readText(formData, "moderationComment", 1000) || null;

  await prisma.$transaction(async (tx) => {
    await tx.creatorCollection.update({
      where: { id },
      data: {
        status,
        moderationComment: status === "PUBLISHED" ? null : moderationComment,
        submittedAt:
          status === "PENDING_REVIEW" || status === "PUBLISHED"
            ? collection.submittedAt ?? now
            : collection.submittedAt,
        publishedAt:
          status === "PUBLISHED" ? collection.publishedAt ?? now : null,
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

    // Keep the hub visible only while the active partner has at least one
    // published collection. This repairs historical "PUBLISHED but 404" data.
    await syncCreatorHubVisibility(tx, {
      hubId: hub.id,
      partnerIsActive: partner.status === "ACTIVE",
    });
  });

  refreshAdmin();
  revalidateCollectionPublication({
    hubSlug: hub.slug,
    collectionSlug: collection.slug,
    collectionId: collection.id,
  });
  redirect(`/admin/collaboration/collections?moderated=1&id=${encodeURIComponent(collection.id)}&status=${status}`);
}

export async function adminSaveMonetizationRate(formData: FormData) {
  const effectiveFrom = new Date(readText(formData, "effectiveFrom") || Date.now());
  const now = new Date();
  await prisma.$transaction([
    prisma.monetizationRate.updateMany({ where: { effectiveTo: null }, data: { effectiveTo: effectiveFrom > now ? effectiveFrom : now } }),
    prisma.monetizationRate.create({
      data: {
        playerStartRate: decimal(readText(formData, "playerStartRate"), "0.00307"),
        videoViewRate: decimal(readText(formData, "videoViewRate"), "0.00220"),
        videoClickRate: decimal(readText(formData, "videoClickRate"), "0.04473"),
        currency: readText(formData, "currency", 8) || "USD",
        effectiveFrom,
      },
    }),
  ]);
  refreshAdmin();
  redirect("/admin/collaboration/settings?saved=1");
}

export async function adminCalculateRevenuePeriod(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  const periodFrom = new Date(readText(formData, "periodFrom"));
  const periodTo = new Date(readText(formData, "periodTo"));
  if (!partnerId || Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) redirect("/admin/collaboration/revenue?error=period");

  const [partner, rate, playerStarts, videoViews, videoClicks] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    getCurrentMonetizationRate(periodFrom),
    prisma.partnerEvent.count({ where: { partnerId, type: "PLAYER_START", createdAt: { gte: periodFrom, lt: periodTo } } }),
    prisma.partnerEvent.count({ where: { partnerId, type: "AD_VIEW", createdAt: { gte: periodFrom, lt: periodTo } } }),
    prisma.partnerEvent.count({ where: { partnerId, type: "AD_CLICK", createdAt: { gte: periodFrom, lt: periodTo } } }),
  ]);
  if (!partner) redirect("/admin/collaboration/revenue?error=partner");
  const estimatedGrossRevenue = calculateGrossRevenue({ playerStarts, videoViews, videoClicks, playerStartRate: rate.playerStartRate, videoViewRate: rate.videoViewRate, videoClickRate: rate.videoClickRate });
  const partnerCommission = calculatePartnerCommission(estimatedGrossRevenue, partner.commissionPercent);

  await prisma.partnerRevenuePeriod.upsert({
    where: { partnerId_periodFrom_periodTo: { partnerId, periodFrom, periodTo } },
    update: { playerStarts, videoViews, videoClicks, estimatedGrossRevenue, partnerCommission, status: "CALCULATED" },
    create: {
      partnerId,
      periodType: validPeriodType(readText(formData, "periodType")),
      periodFrom,
      periodTo,
      playerStarts,
      videoViews,
      videoClicks,
      playerStartRateSnapshot: rate.playerStartRate,
      videoViewRateSnapshot: rate.videoViewRate,
      videoClickRateSnapshot: rate.videoClickRate,
      commissionPercentSnapshot: partner.commissionPercent,
      estimatedGrossRevenue,
      partnerCommission,
      currency: rate.currency,
      status: "CALCULATED",
    },
  });
  refreshAdmin();
  redirect("/admin/collaboration/revenue?calculated=1");
}

export async function adminConfirmRevenuePeriod(formData: FormData) {
  const id = readText(formData, "id");
  const period = id ? await prisma.partnerRevenuePeriod.findUnique({ where: { id } }) : null;
  if (!period) redirect("/admin/collaboration/revenue?error=id");
  const confirmedGrossRevenue = decimal(readText(formData, "confirmedGrossRevenue") || period.estimatedGrossRevenue.toString());
  const manualAdjustment = decimal(readText(formData, "manualAdjustment"), "0");
  const base = confirmedGrossRevenue.add(manualAdjustment);
  const partnerCommission = calculatePartnerCommission(base, period.commissionPercentSnapshot);
  await prisma.partnerRevenuePeriod.update({
    where: { id },
    data: { confirmedGrossRevenue, manualAdjustment, partnerCommission, status: "CONFIRMED", confirmedAt: new Date() },
  });
  refreshAdmin();
  redirect("/admin/collaboration/revenue?confirmed=1");
}

export async function adminCreatePayout(formData: FormData) {
  const partnerId = readText(formData, "partnerId");
  const revenuePeriodId = readText(formData, "revenuePeriodId") || null;
  const periodFrom = new Date(readText(formData, "periodFrom"));
  const periodTo = new Date(readText(formData, "periodTo"));
  if (!partnerId || Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) redirect("/admin/collaboration/payouts?error=required");
  await prisma.partnerPayout.create({
    data: {
      partnerId,
      revenuePeriodId,
      periodFrom,
      periodTo,
      amount: decimal(readText(formData, "amount")),
      currency: readText(formData, "currency", 8) || "USD",
      status: validPayoutStatus(readText(formData, "status")),
      comment: readText(formData, "comment", 1000) || null,
    },
  });
  refreshAdmin();
  redirect("/admin/collaboration/payouts?created=1");
}

export async function adminMarkPayoutPaid(formData: FormData) {
  const id = readText(formData, "id");
  const status = validPayoutStatus(readText(formData, "status"));
  if (!id) redirect("/admin/collaboration/payouts?error=id");
  await prisma.partnerPayout.update({
    where: { id },
    data: { status, paidAt: status === "PAID" ? new Date() : null, comment: readText(formData, "comment", 1000) || undefined },
  });
  refreshAdmin();
  redirect("/admin/collaboration/payouts?updated=1");
}
