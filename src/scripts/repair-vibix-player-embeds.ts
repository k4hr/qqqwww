import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PUBLISHER_ID = process.env.VIBIX_PUBLISHER_ID || "678353780";

type MinimalMovie = {
  id: string;
  titleRu: string;
  vibixId: number | null;
  vibixType: string | null;
  type: ContentType;
  vibixEmbedCode: string | null;
};

function normalizeVibixType(vibixType: string | null, contentType: ContentType) {
  const normalized = (vibixType || "").trim().toLowerCase();
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return "series";
  if (["movie", "film", "cartoon", "anime"].includes(normalized)) return "movie";
  return contentType === ContentType.SERIES ? "series" : "movie";
}

function parseDataAttr(embedCode: string | null, name: string) {
  if (!embedCode) return null;
  const pattern = new RegExp(`${name}\\s*=\\s*["']?([^"'\\s>]+)`, "i");
  return embedCode.match(pattern)?.[1]?.trim() || null;
}

function buildEmbedCode(movie: Pick<MinimalMovie, "vibixId" | "vibixType" | "type">) {
  if (movie.vibixId === null || movie.vibixId === undefined) return null;
  const dataType = normalizeVibixType(movie.vibixType, movie.type);
  return `data-publisher-id="${PUBLISHER_ID}" data-type="${dataType}" data-id="${movie.vibixId}"`;
}

function needsRepair(movie: MinimalMovie) {
  const expectedType = normalizeVibixType(movie.vibixType, movie.type);
  const expectedId = String(movie.vibixId ?? "").trim();
  if (!expectedId) return false;

  const currentType = parseDataAttr(movie.vibixEmbedCode, "data-type")?.toLowerCase();
  const currentId = parseDataAttr(movie.vibixEmbedCode, "data-id");
  const currentPublisher = parseDataAttr(movie.vibixEmbedCode, "data-publisher-id");

  if (!movie.vibixEmbedCode?.trim()) return true;
  if (!currentType || !currentId) return true;
  if (currentType !== expectedType) return true;
  if (currentId !== expectedId) return true;
  if (currentPublisher && currentPublisher !== PUBLISHER_ID) return true;
  return false;
}

async function main() {
  const where: Prisma.MovieWhereInput = {
    vibixAvailable: true,
    vibixId: { not: null },
  };

  const total = await prisma.movie.count({ where });
  let processed = 0;
  let repaired = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    const movies = await prisma.movie.findMany({
      where,
      select: { id: true, titleRu: true, vibixId: true, vibixType: true, type: true, vibixEmbedCode: true },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 500,
    });
    if (!movies.length) break;

    for (const movie of movies) {
      processed += 1;
      cursor = movie.id;
      if (!needsRepair(movie)) {
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
