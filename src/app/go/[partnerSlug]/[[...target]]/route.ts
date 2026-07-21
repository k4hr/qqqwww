import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAttribution } from "@/lib/collaboration/tracking";
import { siteUrl } from "@/lib/seo-links";

type Props = { params: Promise<{ partnerSlug: string; target?: string[] }> };

export async function GET(request: Request, { params }: Props) {
  const { partnerSlug, target = [] } = await params;
  const url = new URL(request.url);
  const source = url.searchParams.get("src")?.trim().slice(0, 80) || null;
  const partner = await prisma.partner.findUnique({ where: { slug: partnerSlug } });
  if (!partner || partner.status !== "ACTIVE" || partner.linksBlocked) return NextResponse.redirect(siteUrl("/"), 302);

  const targetSlug = target.join("/");
  const partnerHub = await prisma.creatorHub.findUnique({ where: { partnerId: partner.id } });
  let redirectPath = partnerHub?.isPublished ? `/collections/${partnerHub.slug}` : "/";
  let partnerLink = targetSlug ? await prisma.partnerLink.findFirst({ where: { partnerId: partner.id, slug: targetSlug, isActive: true } }) : await prisma.partnerLink.findFirst({ where: { partnerId: partner.id, targetType: "AUTHOR_HUB", isActive: true }, orderBy: { createdAt: "asc" } });

  if (partnerLink?.targetType === "AUTHOR_HUB") {
    if (partnerHub?.isPublished) {
      redirectPath = `/collections/${partnerHub.slug}`;
    } else {
      partnerLink = null;
    }
  } else if (partnerLink?.targetType === "COLLECTION" && partnerLink.collectionId) {
    const collection = await prisma.creatorCollection.findUnique({ where: { id: partnerLink.collectionId } });

    if (
      partnerHub?.isPublished &&
      collection?.partnerId === partner.id &&
      collection.hubId === partnerHub.id &&
      collection.status === "PUBLISHED"
    ) {
      redirectPath = `/collections/${partnerHub.slug}/${collection.slug}`;
    } else {
      // Never send traffic to a stale or moderated collection even if an old
      // referral link was accidentally left active.
      partnerLink = null;
    }
  } else if (partnerLink?.targetUrl) {
    redirectPath = partnerLink.targetUrl;
  } else if (target[0] === "watch" && target[1]) {
    redirectPath = `/watch/${target[1]}`;
  } else if (target[0]) {
    const collection = partnerHub?.isPublished ? await prisma.creatorCollection.findFirst({ where: { hubId: partnerHub.id, slug: target[0], status: "PUBLISHED" } }) : null;
    if (collection) {
      redirectPath = `/collections/${partnerHub!.slug}/${collection.slug}`;
      partnerLink ||= await prisma.partnerLink.findFirst({ where: { partnerId: partner.id, collectionId: collection.id, isActive: true } });
    }
  }

  const attributed = await ensureAttribution({ request, partner, partnerLink, source });
  if (attributed?.visitor) {
    await prisma.partnerEvent.create({
      data: {
        partnerId: attributed.attribution?.partnerId || partner.id,
        attributionId: attributed.attribution?.id || null,
        visitorId: attributed.visitor.visitorId,
        partnerLinkId: partnerLink?.id || attributed.attribution?.partnerLinkId || null,
        source,
        type: "LINK_CLICK",
        metadataJson: { target: targetSlug || "hub", redirectPath },
      },
    }).catch(() => undefined);
  }

  return NextResponse.redirect(siteUrl(redirectPath), 302);
}
