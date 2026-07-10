import "server-only";

import { Prisma, type Partner, type PartnerAttribution, type PartnerEventType, type PartnerLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveAttributionForVisitor, getOrCreateVisitor, setAttributionCookies } from "@/lib/collaboration/auth";

const BOT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|telegrambot|whatsapp|vkshare|yandex|google/i;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.max(1, days));
  return next;
}

function isBotRequest(request: Request) {
  return BOT_PATTERN.test(request.headers.get("user-agent") || "");
}

async function createUniqueVisitorEvent(input: { partnerId: string; attributionId?: string | null; visitorId: string; partnerLinkId?: string | null; source?: string | null }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const existing = await prisma.partnerEvent.findFirst({
    where: {
      visitorId: input.visitorId,
      type: "UNIQUE_VISITOR",
      createdAt: { gte: start },
    },
    select: { id: true },
  });
  if (existing) return "RETURN_VISIT" as const;
  await prisma.partnerEvent.create({
    data: {
      partnerId: input.partnerId,
      attributionId: input.attributionId || null,
      visitorId: input.visitorId,
      partnerLinkId: input.partnerLinkId || null,
      source: input.source || null,
      type: "UNIQUE_VISITOR",
    },
  });
  return "UNIQUE_VISITOR" as const;
}

export async function ensureAttribution(input: {
  request: Request;
  partner: Partner;
  partnerLink?: PartnerLink | null;
  source?: string | null;
}) {
  if (isBotRequest(input.request)) return null;
  const visitor = await getOrCreateVisitor(input.request);
  const existing = await getActiveAttributionForVisitor(visitor.visitorId);
  const now = new Date();

  let attribution: PartnerAttribution | null = existing;
  const shouldReplace = !existing || input.partner.attributionModel === "LAST_CLICK" || existing.expiresAt <= now;

  if (shouldReplace) {
    if (existing && existing.partnerId !== input.partner.id) {
      await prisma.partnerAttribution.update({ where: { id: existing.id }, data: { isActive: false } });
    }
    attribution = await prisma.partnerAttribution.create({
      data: {
        visitorId: visitor.visitorId,
        partnerId: input.partner.id,
        partnerLinkId: input.partnerLink?.id || null,
        attributionModel: input.partner.attributionModel,
        startedAt: now,
        expiresAt: addDays(now, input.partner.attributionDays),
      },
    });
  }

  if (attribution) {
    await setAttributionCookies(attribution.partnerId, attribution.partnerLinkId, attribution.startedAt, attribution.expiresAt);
    await createUniqueVisitorEvent({
      partnerId: attribution.partnerId,
      attributionId: attribution.id,
      visitorId: visitor.visitorId,
      partnerLinkId: attribution.partnerLinkId,
      source: input.source,
    });
  }

  return { visitor, attribution };
}

export async function trackPartnerEvent(input: {
  request: Request;
  type: PartnerEventType;
  partnerId?: string | null;
  partnerSlug?: string | null;
  partnerLinkId?: string | null;
  collectionId?: string | null;
  movieId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (isBotRequest(input.request)) return null;
  const visitor = await getOrCreateVisitor(input.request);
  let attribution = await getActiveAttributionForVisitor(visitor.visitorId);
  let partnerId = attribution?.partnerId || input.partnerId || null;

  if (!partnerId && input.partnerSlug) {
    const partner = await prisma.partner.findUnique({ where: { slug: input.partnerSlug } });
    if (partner?.status === "ACTIVE") {
      const ensured = await ensureAttribution({ request: input.request, partner, source: input.source || null });
      attribution = ensured?.attribution || null;
      partnerId = attribution?.partnerId || partner.id;
    }
  }

  if (!partnerId) return null;
  const recentCutoff = new Date(Date.now() - 30_000);
  if (input.type === "PLAYER_START") {
    const duplicate = await prisma.partnerEvent.findFirst({
      where: { visitorId: visitor.visitorId, movieId: input.movieId || null, type: "PLAYER_START", createdAt: { gte: recentCutoff } },
      select: { id: true },
    });
    if (duplicate) return duplicate;
  }

  return prisma.partnerEvent.create({
    data: {
      partnerId,
      attributionId: attribution?.id || null,
      visitorId: visitor.visitorId,
      partnerLinkId: input.partnerLinkId || attribution?.partnerLinkId || null,
      collectionId: input.collectionId || null,
      movieId: input.movieId || null,
      source: input.source || null,
      type: input.type,
      metadataJson: input.metadata ? input.metadata as Prisma.InputJsonValue : undefined,
    },
  });
}
