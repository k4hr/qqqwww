"use server";

import { Prisma, type PartnerLinkTargetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { clearPartnerSession, createPartnerSession, getRequestFingerprint, requirePartnerSession } from "@/lib/collaboration/auth";
import { clampNumber, readText, verifyPassword } from "@/lib/collaboration/security";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

function partnerPaths() {
  return ["/partner", "/partner/links", "/partner/collections", "/partner/statistics", "/partner/revenue", "/partner/payouts", "/partner/settings"];
}

function refreshPartner() {
  for (const path of partnerPaths()) revalidatePath(path);
}

function validTargetType(value: string): PartnerLinkTargetType {
  return ["AUTHOR_HUB", "COLLECTION", "MOVIE", "HOME", "CUSTOM"].includes(value) ? value as PartnerLinkTargetType : "AUTHOR_HUB";
}

export async function partnerLogin(formData: FormData) {
  const login = readText(formData, "login", 80).toLowerCase();
  const password = readText(formData, "password", 200);
  const fingerprint = await getRequestFingerprint();
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const attempts = await prisma.partnerLoginAttempt.count({ where: { login, success: false, createdAt: { gte: since } } });
  if (attempts >= 8) redirect("/partner/login?error=rate");

  const partner = await prisma.partner.findUnique({ where: { login } });
  const ok = Boolean(partner && partner.status === "ACTIVE" && verifyPassword(password, partner.passwordHash));
  await prisma.partnerLoginAttempt.create({ data: { login, ipHash: fingerprint.ipHash, success: ok } }).catch(() => undefined);
  if (!partner || !ok) redirect("/partner/login?error=invalid");

  await prisma.$transaction([
    prisma.partner.update({ where: { id: partner.id }, data: { lastLoginAt: new Date() } }),
    prisma.partnerSession.deleteMany({ where: { partnerId: partner.id, expiresAt: { lt: new Date() } } }),
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
  if (!partner.canManageCollections) redirect("/partner/collections?error=forbidden");
  const hub = await prisma.creatorHub.findUnique({ where: { partnerId: partner.id } });
  if (!hub) redirect("/partner/collections?error=hub");
  const title = readText(formData, "title", 160);
  const slug = slugify(readText(formData, "slug", 120) || title);
  if (!title || !slug) redirect("/partner/collections/new?error=required");
  const status = partner.requireCollectionModeration ? "DRAFT" : "PUBLISHED";
  const collection = await prisma.creatorCollection.create({
    data: {
      hubId: hub.id,
      partnerId: partner.id,
      title,
      slug,
      description: readText(formData, "description", 1000) || null,
      coverUrl: readText(formData, "coverUrl", 500) || null,
      position: Math.floor(clampNumber(readText(formData, "position"), 0, 0, 10_000)),
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  refreshPartner();
  revalidatePath(`/collections/${hub.slug}`);
  redirect(`/partner/collections/${collection.id}`);
}

export async function partnerUpdateCollection(formData: FormData) {
  const { partner } = await requirePartnerSession();
  const id = readText(formData, "id");
  const collection = id ? await prisma.creatorCollection.findUnique({ where: { id } }) : null;
  if (!collection || collection.partnerId !== partner.id) redirect("/partner/collections?error=not_found");
  const title = readText(formData, "title", 160);
  const slug = slugify(readText(formData, "slug", 120) || title);
  await prisma.creatorCollection.update({
    where: { id },
    data: {
      title,
      slug,
      description: readText(formData, "description", 1000) || null,
      coverUrl: readText(formData, "coverUrl", 500) || null,
      position: Math.floor(clampNumber(readText(formData, "position"), collection.position, 0, 10_000)),
      status: collection.status === "PUBLISHED" && partner.requireCollectionModeration ? "PENDING_REVIEW" : collection.status,
      submittedAt: collection.status === "PUBLISHED" && partner.requireCollectionModeration ? new Date() : collection.submittedAt,
    },
  });
  refreshPartner();
  redirect(`/partner/collections/${id}?saved=1`);
}

export async function partnerSubmitCollection(formData: FormData) {
  const { partner } = await requirePartnerSession();
  const id = readText(formData, "id");
  const collection = id ? await prisma.creatorCollection.findUnique({ where: { id } }) : null;
  if (!collection || collection.partnerId !== partner.id) redirect("/partner/collections?error=not_found");
  const status = partner.requireCollectionModeration ? "PENDING_REVIEW" : "PUBLISHED";
  await prisma.creatorCollection.update({ where: { id }, data: { status, submittedAt: new Date(), publishedAt: status === "PUBLISHED" ? new Date() : collection.publishedAt } });
  refreshPartner();
  redirect(`/partner/collections/${id}?submitted=1`);
}

export async function partnerAddMovie(formData: FormData) {
  const { partner } = await requirePartnerSession();
  const collectionId = readText(formData, "collectionId");
  const movieId = readText(formData, "movieId");
  const collection = collectionId ? await prisma.creatorCollection.findUnique({ where: { id: collectionId } }) : null;
  if (!collection || collection.partnerId !== partner.id) redirect("/partner/collections?error=not_found");
  const movie = movieId ? await prisma.movie.findFirst({ where: { AND: [vibixPublicMovieWhere, { id: movieId }] }, select: { id: true } }) : null;
  if (!movie) redirect(`/partner/collections/${collectionId}?error=movie_not_public`);
  const last = await prisma.creatorCollectionMovie.findFirst({ where: { collectionId }, orderBy: { position: "desc" } });
  await prisma.creatorCollectionMovie.upsert({
    where: { collectionId_movieId: { collectionId, movieId } },
    update: { authorComment: readText(formData, "authorComment", 1000) || undefined },
    create: { collectionId, movieId, position: (last?.position ?? -1) + 1, authorComment: readText(formData, "authorComment", 1000) || null },
  });
  refreshPartner();
  redirect(`/partner/collections/${collectionId}?added=1`);
}

export async function partnerRemoveMovie(formData: FormData) {
  const { partner } = await requirePartnerSession();
  const id = readText(formData, "id");
  const item = id ? await prisma.creatorCollectionMovie.findUnique({ where: { id } }) : null;
  const collection = item ? await prisma.creatorCollection.findUnique({ where: { id: item.collectionId } }) : null;
  if (!item || !collection || collection.partnerId !== partner.id) redirect("/partner/collections?error=not_found");
  await prisma.creatorCollectionMovie.delete({ where: { id } });
  refreshPartner();
  redirect(`/partner/collections/${collection.id}?removed=1`);
}

export async function partnerReorderMovies(formData: FormData) {
  const { partner } = await requirePartnerSession();
  const collectionId = readText(formData, "collectionId");
  const collection = collectionId ? await prisma.creatorCollection.findUnique({ where: { id: collectionId } }) : null;
  if (!collection || collection.partnerId !== partner.id) redirect("/partner/collections?error=not_found");
  const updates: Array<Prisma.PrismaPromise<unknown>> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("position:") || typeof value !== "string") continue;
    const id = key.slice("position:".length);
    updates.push(prisma.creatorCollectionMovie.updateMany({ where: { id, collectionId }, data: { position: Math.floor(clampNumber(value, 0, 0, 10_000)), authorComment: readText(formData, `comment:${id}`, 1000) || null } }));
  }
  await prisma.$transaction(updates);
  refreshPartner();
  redirect(`/partner/collections/${collectionId}?ordered=1`);
}

export async function partnerCreateLink(formData: FormData) {
  const { partner } = await requirePartnerSession();
  if (partner.linksBlocked) redirect("/partner/links?error=blocked");
  const name = readText(formData, "name", 120);
  const slug = slugify(readText(formData, "slug", 120) || name);
  if (!name || !slug) redirect("/partner/links?error=required");
  const collectionId = readText(formData, "collectionId") || null;
  const movieId = readText(formData, "movieId") || null;
  if (collectionId) {
    const collection = await prisma.creatorCollection.findFirst({ where: { id: collectionId, partnerId: partner.id } });
    if (!collection) redirect("/partner/links?error=collection");
  }
  if (movieId) {
    const movie = await prisma.movie.findFirst({ where: { AND: [vibixPublicMovieWhere, { id: movieId }] }, select: { id: true } });
    if (!movie) redirect("/partner/links?error=movie");
  }
  await prisma.partnerLink.create({
    data: {
      partnerId: partner.id,
      name,
      slug,
      source: readText(formData, "source", 80) || null,
      targetType: validTargetType(readText(formData, "targetType")),
      targetUrl: readText(formData, "targetUrl", 500) || null,
      collectionId,
      movieId,
      isActive: true,
    },
  });
  refreshPartner();
  redirect("/partner/links?created=1");
}
