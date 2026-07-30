import { enqueueSocialJob } from "@/lib/social/queue";
import { prisma } from "@/lib/prisma";
await enqueueSocialJob({ type: "CLEAN_TEMP_OBJECTS", idempotencyKey: `social-cleanup:${new Date().toISOString().slice(0, 13)}` });
console.log("Social cleanup job queued");
await prisma.$disconnect();
