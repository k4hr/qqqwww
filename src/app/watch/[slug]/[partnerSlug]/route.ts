import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAttribution } from "@/lib/collaboration/tracking";
import { siteUrl } from "@/lib/seo-links";

type Props = {
  params: Promise<{
    slug: string;
    partnerSlug: string;
  }>;
};

export async function GET(request: Request, { params }: Props) {
  const { slug, partnerSlug } = await params;
  const canonicalPath = `/watch/${slug}`;
  const fallback = NextResponse.redirect(siteUrl(canonicalPath), 302);

  const [movie, partner] = await Promise.all([
    prisma.movie.findFirst({
      where: { slug },
      select: { id: true, slug: true, titleRu: true },
    }),
    prisma.partner.findUnique({ where: { slug: partnerSlug } }),
  ]);

  if (!movie || !partner || partner.status !== "ACTIVE" || partner.linksBlocked) {
    return fallback;
  }

  const partnerLink = await prisma.partnerLink.upsert({
    where: {
      partnerId_slug: {
        partnerId: partner.id,
        slug: `watch-${movie.slug}`,
      },
    },
    update: {
      name: movie.titleRu,
      targetType: "MOVIE",
      targetUrl: canonicalPath,
      movieId: movie.id,
      isActive: true,
    },
    create: {
      partnerId: partner.id,
      name: movie.titleRu,
      slug: `watch-${movie.slug}`,
      targetType: "MOVIE",
      targetUrl: canonicalPath,
      movieId: movie.id,
      isActive: true,
    },
  });

  const sourceUrl = new URL(request.url);
  const source = sourceUrl.searchParams.get("src")?.trim().slice(0, 80) || "direct_watch_link";
  const attributed = await ensureAttribution({ request, partner, partnerLink, source });

  if (attributed?.visitor) {
    await prisma.partnerEvent.create({
      data: {
        partnerId: attributed.attribution?.partnerId || partner.id,
        attributionId: attributed.attribution?.id || null,
        visitorId: attributed.visitor.visitorId,
        partnerLinkId: partnerLink.id,
        movieId: movie.id,
        source,
        type: "LINK_CLICK",
        metadataJson: {
          target: "watch",
          movieSlug: movie.slug,
          partnerSlug: partner.slug,
          redirectPath: canonicalPath,
        },
      },
    }).catch(() => undefined);
  }

  return NextResponse.redirect(siteUrl(canonicalPath), 302);
}
