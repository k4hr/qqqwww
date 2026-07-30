import { prisma } from "@/lib/prisma";

export async function socialAudit(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  await prisma.socialAuditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      actor: input.actor || "admin",
      before: input.before as never,
      after: input.after as never,
      metadata: input.metadata as never,
    },
  });
}
