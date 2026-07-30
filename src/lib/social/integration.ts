import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/social/crypto";

export async function getVkCredentials() {
  const integration = await prisma.socialIntegration.findUnique({ where: { provider: "VK" } });
  if (!integration?.encryptedAccessToken || !integration.externalGroupId) throw new Error("VK integration is not configured");
  return { integration, token: decryptSecret(integration.encryptedAccessToken), groupId: integration.externalGroupId };
}
