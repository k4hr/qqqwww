"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/social/crypto";
import { socialAudit } from "@/lib/social/audit";
import { validateVkConnection } from "@/lib/social/providers/vk/client";
import { enqueueSocialJob } from "@/lib/social/queue";
import { generateSocialIdeas, ideaHash, researchSocialTopic, writeSocialPost } from "@/lib/social/ai/generation";

function text(fd: FormData, key: string) { return String(fd.get(key) || "").trim(); }
function dateValue(fd: FormData, key: string) { const value = text(fd, key); return value ? new Date(value) : null; }
function go(path: string, params: Record<string, string>): never { const q = new URLSearchParams(params); redirect(`${path}?${q}`); }

export async function saveVkIntegrationAction(formData: FormData) {
  const groupId = text(formData, "groupId").replace(/^-/, "");
  const token = text(formData, "token");
  if (!groupId || !token) go("/admin/social/integrations", { error: "Нужны ID сообщества и токен" });
  try {
    const validation = await validateVkConnection(token, groupId);
    const existing = await prisma.socialIntegration.findUnique({ where: { provider: "VK" } });
    const saved = await prisma.socialIntegration.upsert({
      where: { provider: "VK" },
      create: { provider: "VK", status: "CONNECTED", displayName: validation.group.name, externalGroupId: groupId, encryptedAccessToken: encryptSecret(token), tokenLastFour: token.slice(-4), capabilities: validation.capabilities, lastCheckedAt: new Date(), lastSuccessAt: new Date() },
      update: { status: "CONNECTED", displayName: validation.group.name, externalGroupId: groupId, encryptedAccessToken: encryptSecret(token), tokenLastFour: token.slice(-4), capabilities: validation.capabilities, lastCheckedAt: new Date(), lastSuccessAt: new Date(), lastError: null },
    });
    await socialAudit({ action: "VK_INTEGRATION_SAVED", entityType: "SocialIntegration", entityId: saved.id, before: existing ? { status: existing.status, groupId: existing.externalGroupId } : null, after: { status: saved.status, groupId, capabilities: validation.capabilities } });
    revalidatePath("/admin/social/integrations");
    go("/admin/social/integrations", { saved: "1" });
  } catch (error) {
    await prisma.socialIntegration.upsert({ where: { provider: "VK" }, create: { provider: "VK", status: "ERROR", externalGroupId: groupId, encryptedAccessToken: encryptSecret(token), tokenLastFour: token.slice(-4), lastCheckedAt: new Date(), lastError: error instanceof Error ? error.message : String(error) }, update: { status: "ERROR", externalGroupId: groupId, encryptedAccessToken: encryptSecret(token), tokenLastFour: token.slice(-4), lastCheckedAt: new Date(), lastError: error instanceof Error ? error.message : String(error) } });
    go("/admin/social/integrations", { error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createPostAction(formData: FormData) {
  const type = (text(formData, "type") || "TEXT") as "TEXT" | "IMAGE_POST" | "GALLERY";
  const body = text(formData, "body");
  const scheduledAt = dateValue(formData, "scheduledAt");
  const mediaIds = formData.getAll("mediaIds").map(String).filter(Boolean);
  const action = text(formData, "submitAction");
  if (!body) go("/admin/social/posts/new", { error: "Текст публикации пуст" });
  const status = action === "publish" ? "APPROVED" : scheduledAt ? "SCHEDULED" : "DRAFT";
  const post = await prisma.socialPost.create({
    data: {
      type, status, title: text(formData, "title") || null, hook: text(formData, "hook") || null, body,
      hashtags: text(formData, "hashtags").split(/[\s,]+/).map((v) => v.replace(/^#/, "")).filter(Boolean),
      scheduledAt: scheduledAt || null, approvedAt: status === "APPROVED" || status === "SCHEDULED" ? new Date() : null,
      movieId: text(formData, "movieId") || null, utmCode: crypto.randomBytes(8).toString("hex"),
      media: { create: mediaIds.map((mediaAssetId, position) => ({ mediaAssetId, position, role: position === 0 ? "COVER" : "ATTACHMENT" })) },
    },
  });
  if (status === "APPROVED" || status === "SCHEDULED") await enqueueSocialJob({ type: "PUBLISH_VK_POST", provider: "VK", postId: post.id, scheduledAt: scheduledAt || new Date(), idempotencyKey: `vk-post:${post.id}` });
  await socialAudit({ action: "SOCIAL_POST_CREATED", entityType: "SocialPost", entityId: post.id, after: { type, status, scheduledAt } });
  revalidatePath("/admin/social"); revalidatePath("/admin/social/posts"); revalidatePath("/admin/social/calendar");
  go("/admin/social/posts", { created: post.id });
}

export async function createClipAction(formData: FormData) {
  const mediaId = text(formData, "mediaId");
  if (!mediaId) go("/admin/social/clips/new", { error: "Сначала загрузите MP4 в R2" });
  const scheduledAt = dateValue(formData, "scheduledAt");
  const post = await prisma.socialPost.create({
    data: {
      type: "CLIP", status: scheduledAt ? "SCHEDULED" : "APPROVED", title: text(formData, "title") || "REDFILM", body: text(formData, "description"), hashtags: text(formData, "hashtags").split(/[\s,]+/).map((v) => v.replace(/^#/, "")).filter(Boolean), scheduledAt, approvedAt: new Date(), movieId: text(formData, "movieId") || null, utmCode: crypto.randomBytes(8).toString("hex"), media: { create: [{ mediaAssetId: mediaId, role: "CLIP", position: 0 }] },
    },
  });
  await enqueueSocialJob({ type: "UPLOAD_VK_CLIP", provider: "VK", postId: post.id, scheduledAt: scheduledAt || new Date(), idempotencyKey: `vk-clip:${post.id}` });
  await socialAudit({ action: "SOCIAL_CLIP_CREATED", entityType: "SocialPost", entityId: post.id, after: { scheduledAt } });
  go("/admin/social/clips", { created: post.id });
}

export async function cancelPostAction(formData: FormData) {
  const id = text(formData, "id");
  await prisma.$transaction([prisma.socialPost.update({ where: { id }, data: { status: "CANCELLED" } }), prisma.socialPublishJob.updateMany({ where: { postId: id, status: { in: ["PENDING", "RETRY", "LEASED"] } }, data: { status: "CANCELLED" } })]);
  await socialAudit({ action: "SOCIAL_POST_CANCELLED", entityType: "SocialPost", entityId: id });
  revalidatePath("/admin/social/calendar"); revalidatePath("/admin/social/posts");
}

export async function reschedulePostAction(formData: FormData) {
  const id = text(formData, "id"); const scheduledAt = dateValue(formData, "scheduledAt");
  if (!scheduledAt) return;
  await prisma.$transaction([prisma.socialPost.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt } }), prisma.socialPublishJob.updateMany({ where: { postId: id, status: { in: ["PENDING", "RETRY"] } }, data: { scheduledAt, nextAttemptAt: null } })]);
  await socialAudit({ action: "SOCIAL_POST_RESCHEDULED", entityType: "SocialPost", entityId: id, after: { scheduledAt } });
  revalidatePath("/admin/social/calendar");
}

export async function retryJobAction(formData: FormData) {
  const id = text(formData, "id");
  await prisma.socialPublishJob.update({ where: { id }, data: { status: "PENDING", nextAttemptAt: null, scheduledAt: new Date(), lastError: null, lockedAt: null, lockedBy: null, leaseExpiresAt: null } });
  revalidatePath("/admin/social/queue");
}

export async function generateIdeasAction(formData: FormData) {
  const movieId = text(formData, "movieId"); const customTitle = text(formData, "title");
  const movie = movieId ? await prisma.movie.findUnique({ where: { id: movieId }, select: { titleRu: true, year: true, description: true } }) : null;
  const title = customTitle || movie?.titleRu;
  if (!title) go("/admin/social/ideas", { error: "Выберите фильм или укажите тему" });
  const result = await generateSocialIdeas({ title, year: movie?.year, context: movie?.description });
  let count = 0;
  for (const idea of result.ideas) {
    const created = await prisma.socialIdea.upsert({ where: { duplicateHash: ideaHash(idea.topic) }, create: { topic: idea.topic, category: idea.category, hook: idea.hook, potentialScore: idea.potentialScore, duplicateHash: ideaHash(idea.topic), movieId: movieId || null }, update: {} });
    if (created) count++;
  }
  go("/admin/social/ideas", { generated: String(count) });
}

export async function researchIdeaAction(formData: FormData) {
  const ideaId = text(formData, "ideaId");
  const idea = await prisma.socialIdea.findUnique({ where: { id: ideaId } });
  if (!idea) return;
  const research = await prisma.socialResearch.create({ data: { topic: idea.topic, status: "RUNNING", movieId: idea.movieId, startedAt: new Date() } });
  try {
    const result = await researchSocialTopic(idea.topic);
    const created = await prisma.socialResearch.update({ where: { id: research.id }, data: { status: "COMPLETED", summary: result.summary, completedAt: new Date(), sources: { create: result.sources }, facts: { create: result.facts.map((fact) => ({ claim: fact.claim, confidence: fact.confidence, status: fact.confidence >= 0.75 ? "VERIFIED" : "PARTIALLY_SUPPORTED", supportingExcerpt: fact.sourceUrl })) } }, include: { sources: true, facts: true } });
    const draft = await writeSocialPost({ topic: idea.topic, sources: created.sources.map((s) => ({ url: s.url, excerpt: s.excerpt || "" })), facts: created.facts.filter((f) => f.status === "VERIFIED").map((f) => ({ claim: f.claim, confidence: f.confidence || 0 })) });
    const post = await prisma.socialPost.create({ data: { type: "IMAGE_POST", status: draft.unsupportedClaims.length ? "NEEDS_REVIEW" : "DRAFT", title: draft.title, hook: draft.hook, body: draft.body, hashtags: draft.hashtags, researchId: research.id, movieId: idea.movieId, utmCode: crypto.randomBytes(8).toString("hex"), immutableSnapshot: { imageQueries: draft.imageQueries, unsupportedClaims: draft.unsupportedClaims } } });
    await prisma.socialIdea.update({ where: { id: idea.id }, data: { status: "USED" } });
    go("/admin/social/posts", { generated: post.id });
  } catch (error) {
    await prisma.socialResearch.update({ where: { id: research.id }, data: { status: "FAILED", summary: error instanceof Error ? error.message : String(error), completedAt: new Date() } });
    go("/admin/social/ideas", { error: error instanceof Error ? error.message : String(error) });
  }
}
