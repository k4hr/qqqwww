"use server";

import { Prisma, type CreatorCollectionStatus, type PartnerAttributionModel, type PartnerLinkTargetType, type PartnerPayoutStatus, type PartnerRevenuePeriodType, type PartnerStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { calculateGrossRevenue, calculatePartnerCommission, getCurrentMonetizationRate } from "@/lib/collaboration/revenue";
import { clampNumber, hashPassword, randomToken, readBool, readText } from "@/lib/collaboration/security";
import { readImageDataUrl } from "@/lib/collaboration/image-upload";

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
      isPublished: partner.status === "ACTIVE",
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
  const existing = await prisma.partner.findUnique({ where: { id }, select: { avatarUrl: true, coverUrl: true } });
  if (!existing) redirect("/admin/collaboration/partners?error=id");
  const slug = slugify(readText(formData, "slug", 90));
  const avatarUrl = await readImageDataUrl(formData, "avatarImage", existing.avatarUrl);
  const coverUrl = await readImageDataUrl(formData, "coverImage", existing.coverUrl);
  await prisma.partner.update({
    where: { id },
    data: {
      name: readText(formData, "name", 120),
      publicName: readText(formData, "publicName", 120) || null,
      cabinetTitle: readText(formData, "cabinetTitle", 160) || null,
      slug,
      email: readText(formData, "email", 200) || null,
      avatarUrl,
      coverUrl,
      description: readText(formData, "description", 2000) || null,
      attributionDays: Math.floor(clampNumber(readText(formData, "attributionDays"), 30, 1, 365)),
      attributionModel: validAttributionModel(readText(formData, "attributionModel")),
      status: validStatus(readText(formData, "status")),
      canManageCollections: readBool(formData, "canManageCollections", true),
      requireCollectionModeration: readBool(formData, "requireCollectionModeration", true),
      showFinancials: readBool(formData, "showFinancials", true),
      linksBlocked: readBool(formData, "linksBlocked", false),
      adminComment: readText(formData, "adminComment", 2000) || null,
    },
  });
  await prisma.creatorHub.updateMany({
    where: { partnerId: id },
    data: { slug, title: `Подборки ${readText(formData, "publicName", 120) || readText(formData, "name", 120)}`, description: readText(formData, "description", 2000) || null, coverUrl, isPublished: validStatus(readText(formData, "status")) === "ACTIVE" },
  });
  refreshAdmin();
  redirect("/admin/collaboration/partners?updated=1");
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
  await prisma.creatorHub.updateMany({ where: { partnerId }, data: { isPublished: status === "ACTIVE" } });
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

export async function adminModerateCollection(formData: FormData) {
  const id = readText(formData, "id");
  const status = validCollectionStatus(readText(formData, "status"));
  if (!id) redirect("/admin/collaboration/collections?error=id");
  await prisma.creatorCollection.update({
    where: { id },
    data: {
      status,
      moderationComment: readText(formData, "moderationComment", 1000) || null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  refreshAdmin();
  revalidatePath("/collections/[slug]", "page");
  redirect("/admin/collaboration/collections?moderated=1");
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
