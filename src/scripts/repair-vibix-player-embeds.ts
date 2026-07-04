import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PUBLISHER_ID = process.env.VIBIX_PUBLISHER_ID || "678353780";

function normalizeVibixType(vibixType: string | null, contentType: ContentType) {
  const normalized = (vibixType || "").trim().toLowerCase();
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return "series";
  if (["movie", "film"].includes(normalized)) return "movie";
  return contentType === ContentType.SERIES ? "series" : "movie";
}

function hasValidEmbedCode(value: string | null) {
  if (!value) return false;
  return /data-id\s*=\s*["']?\d+/i.test(value) && /data-type\s*=\s*["']?(movie|series|serial|kp|imdb)/i.test(value);
}

function buildEmbedCode(movie: { vibixId: number | null; vibixType: string | null; type: ContentType }) {
  if (movie.vibixId === null || movie.vibixId === undefined) return null;
  const dataType = normalizeVibixType(movie.vibixType, movie.type);
  return `data-publisher-id="${PUBLISHER_ID}" data-type="${dataType}" data-id="${movie.vibixId}"`;
}

async function main() {
  const where: Prisma.MovieWhereInput = {
    vibixAvailable: true,
    vibixId: { not: null },
    OR: [
      { vibixEmbedCode: null },
      { vibixEmbedCode: "" },
      { vibixEmbedCode: { not: { contains: "data-id" } } },
    ],
  };

  const total = await prisma.movie.count({ where });
  let processed = 0;
  let repaired = 0;
  let skipped = 0;

  while (true) {
    const movies = await prisma.movie.findMany({
      where,
      select: { id: true, titleRu: true, vibixId: true, vibixType: true, type: true, vibixEmbedCode: true },
      orderBy: { updatedAt: "asc" },
      take: 500,
    });
    if (!movies.length) break;

    for (const movie of movies) {
      processed += 1;
      if (hasValidEmbedCode(movie.vibixEmbedCode)) {
        skipped += 1;
        continue;
      }
      const embedCode = buildEmbedCode(movie);
      if (!embedCode) {
        skipped += 1;
        continue;
      }
      await prisma.movie.update({
        where: { id: movie.id },
        data: {
          vibixEmbedCode: embedCode,
          vibixAvailable: true,
          isPublished: true,
          isCatalogAllowed: true,
          isPublicVisible: true,
          catalogBlockReason: null,
          vibixLastSyncAt: new Date(),
        },
      });
      repaired += 1;
    }
    console.log(`[repair-vibix-player-embeds] processed=${processed}/${total} repaired=${repaired} skipped=${skipped}`);
  }

  console.log(JSON.stringify({ ok: true, total, processed, repaired, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
