import { prisma } from "@/lib/prisma";
import { applySeoLandingQualityGate, importEmbeddedWordstatFiles } from "@/lib/seo/keyword-engine";
import { generateTopAiSeoLandingPages } from "@/lib/seo/ai-builder";

export async function cleanupBadSeoPages() {
  const [baseRedirects, numericPages, botTextPages] = await Promise.all([
    prisma.seoLandingPage.updateMany({
      where: { OR: [{ type: "BASE" }, { slug: { in: ["filmy-smotret-online", "serialy-smotret-online", "multfilmy-smotret-online", "anime-smotret-online"] } }] },
      data: { status: "REDIRECT", isIndexable: false, sitemapIncluded: false },
    }).catch(() => ({ count: 0 })),
    prisma.seoLandingPage.updateMany({
      where: { slug: { contains: "10289075" } },
      data: { status: "THIN", isIndexable: false, sitemapIncluded: false },
    }).catch(() => ({ count: 0 })),
    prisma.seoLandingPage.updateMany({
      where: {
        OR: [
          { introText: { contains: "Wordstat", mode: "insensitive" as const } },
          { introText: { contains: "суммарный спрос", mode: "insensitive" as const } },
          { description: { contains: "Wordstat", mode: "insensitive" as const } },
        ],
      },
      data: { aiStatus: "NOT_GENERATED" },
    }).catch(() => ({ count: 0 })),
  ]);

  return { baseRedirects: baseRedirects.count, numericPages: numericPages.count, botTextPages: botTextPages.count };
}

export async function runSeoAutopilot(options?: { aiLimit?: number; rebuildWordstat?: boolean }) {
  const aiLimit = Math.max(0, Math.min(Number(options?.aiLimit ?? 5), 30));
  const rebuildWordstat = options?.rebuildWordstat ?? true;
  const startedAt = new Date();

  const cleanupBefore = await cleanupBadSeoPages();
  const wordstat = rebuildWordstat ? await importEmbeddedWordstatFiles({ replace: true }) : null;
  const quality = await applySeoLandingQualityGate();
  const ai = process.env.OPENAI_API_KEY && aiLimit > 0 ? await generateTopAiSeoLandingPages(aiLimit) : { skipped: true, reason: process.env.OPENAI_API_KEY ? "AI limit is 0" : "OPENAI_API_KEY is not configured" };
  const cleanupAfter = await cleanupBadSeoPages();

  const stats = await Promise.all([
    prisma.seoKeyword.count().catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    prisma.seoLandingPage.count({ where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true } }).catch(() => 0),
    prisma.seoLandingPage.count({ where: { status: "THIN" } }).catch(() => 0),
    prisma.seoLandingPage.count({ where: { status: "REDIRECT" } }).catch(() => 0),
  ]);

  return {
    ok: true,
    startedAt,
    finishedAt: new Date(),
    cleanupBefore,
    wordstat,
    quality,
    ai,
    cleanupAfter,
    totals: {
      keywords: stats[0],
      activeKeywords: stats[1],
      indexablePages: stats[2],
      thinPages: stats[3],
      redirectPages: stats[4],
    },
  };
}
