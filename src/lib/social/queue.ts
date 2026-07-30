import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SocialJobType, SocialProvider } from "@prisma/client";

export async function enqueueSocialJob(input: {
  type: SocialJobType;
  postId?: string;
  provider?: SocialProvider;
  scheduledAt?: Date;
  payload?: unknown;
  idempotencyKey?: string;
  priority?: number;
}) {
  const idempotencyKey = input.idempotencyKey || `${input.type}:${input.postId || "global"}:${input.scheduledAt?.toISOString() || crypto.randomUUID()}`;
  return prisma.socialPublishJob.upsert({
    where: { idempotencyKey },
    create: {
      type: input.type,
      postId: input.postId,
      provider: input.provider,
      scheduledAt: input.scheduledAt || new Date(),
      payload: input.payload as never,
      priority: input.priority || 0,
      idempotencyKey,
    },
    update: {},
  });
}

export async function leaseNextSocialJob(workerId: string, leaseSeconds: number) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "SocialPublishJob"
      WHERE status IN ('PENDING','RETRY')
        AND "scheduledAt" <= NOW()
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < NOW())
      ORDER BY priority DESC, "scheduledAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return tx.socialPublishJob.update({
      where: { id: rows[0].id },
      data: {
        status: "LEASED",
        lockedAt: new Date(),
        lockedBy: workerId,
        heartbeatAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + leaseSeconds * 1000),
      },
      include: { post: { include: { media: { include: { mediaAsset: true }, orderBy: { position: "asc" } } } } },
    });
  });
}

export function retryDelayMs(attempt: number) {
  const steps = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000, 12 * 60 * 60_000];
  return steps[Math.min(Math.max(0, attempt - 1), steps.length - 1)];
}
