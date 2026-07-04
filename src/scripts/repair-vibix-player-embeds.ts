import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVibixVideoByImdbIdResult, getVibixVideoByKpIdResult, sleep, type VibixVideo } from "@/lib/vibix";

const PUBLISHER_ID = process.env.VIBIX_PUBLISHER_ID || "678353780";
const LIMIT = positiveInt(process.env.VIBIX_REPAIR_LIMIT, 0);
const BATCH_SIZE = positiveInt(process.env.VIBIX_REPAIR_BATCH_SIZE, 200) || 200;
const DELAY_MS = positiveInt(process.env.VIBIX_REPAIR_DELAY_MS, 150);
const RATE_LIMIT_SLEEP_MS = positiveInt(process.env.VIBIX_REPAIR_RATE_LIMIT_SLEEP_MS, 60_000) || 60_000;

type MinimalMovie = {
  id: string;
  slug: string;
  titleRu: string;
  kinopoiskId: string | null;
  imdbId: string | null;
  vibixId: number | null;
  vibixType: string | null;
  vibixEmbedCode: string | null;
  vibixIframeUrl: string | null;
};

function positiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseDataAttr(embedCode: string | null | undefined, name: string) {
  if (!embedCode) return null;
  const pattern = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return embedCode.match(pattern)?.[2]?.trim() || null;
}

function hasUsableEmbed(embedCode: string | null | undefined) {
  const type = parseDataAttr(embedCode, "data-type");
  const id = parseDataAttr(embedCode, "data-id");
  return Boolean(type && id);
}

function normalizePublisher(embedCode: string) {
  const publisher = parseDataAttr(embedCode, "data-publisher-id");
  if (publisher) return embedCode;
  return `data-publisher-id="${PUBLISHER_ID}" ${embedCode}`;
}

function videoEmbed(video: VibixVideo | null | undefined) {
  const exactEmbed = stringValue(video?.embed_code);
  if (exactEmbed && hasUsableEmbed(exactEmbed)) return normalizePublisher(exactEmbed);
  return null;
}

function videoIframe(video: VibixVideo | null | undefined) {
  return stringValue(video?.iframe_url);
}

function samePlayer(movie: MinimalMovie, detail: VibixVideo) {
  const nextEmbed = videoEmbed(detail);
  const nextIframe = videoIframe(detail);
  const nextVibixId = intValue(detail.id);
  const nextVibixType = stringValue(detail.type);

  const currentEmbed = stringValue(movie.vibixEmbedCode);
  const currentIframe = stringValue(movie.vibixIframeUrl);

  return Boolean(
    (!nextEmbed || currentEmbed === nextEmbed)
    && (!nextIframe || currentIframe === nextIframe)
    && (nextVibixId === null || movie.vibixId === nextVibixId)
    && (!nextVibixType || movie.vibixType === nextVibixType)
  );
}

async function fetchDetail(movie: MinimalMovie) {
  if (movie.kinopoiskId) {
    const lookup = await getVibixVideoByKpIdResult(movie.kinopoiskId);
    if (lookup.video || lookup.rateLimited || lookup.requestFailed) return lookup;
  }
  if (movie.imdbId) {
    return getVibixVideoByImdbIdResult(movie.imdbId);
  }
  return null;
}

async function main() {
  const where: Prisma.MovieWhereInput = {
    vibixAvailable: true,
    OR: [
      { kinopoiskId: { not: null } },
      { imdbId: { not: null } },
    ],
  };

  const totalAll = await prisma.movie.count({ where });
  const total = LIMIT > 0 ? Math.min(LIMIT, totalAll) : totalAll;
  let processed = 0;
  let repaired = 0;
  let hidden = 0;
  let skipped = 0;
  let failed = 0;
  let rateLimited = 0;
  let cursor: string | undefined;

  while (processed < total) {
    const take = Math.min(BATCH_SIZE, total - processed);
    const movies: MinimalMovie[] = await prisma.movie.findMany({
      where,
      select: {
        id: true,
        slug: true,
        titleRu: true,
        kinopoiskId: true,
        imdbId: true,
        vibixId: true,
        vibixType: true,
        vibixEmbedCode: true,
        vibixIframeUrl: true,
      },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
    });
    if (!movies.length) break;

    for (const movie of movies) {
      processed += 1;
      cursor = movie.id;

      try {
        const lookup = await fetchDetail(movie);
        if (!lookup) {
          skipped += 1;
          continue;
        }

        if (lookup.rateLimited) {
          rateLimited += 1;
          const sleepMs = lookup.retryAfterMs && lookup.retryAfterMs > 0 ? lookup.retryAfterMs : RATE_LIMIT_SLEEP_MS;
          console.log(`[repair-vibix-player-embeds] rate limited; sleeping ${sleepMs}ms`);
          await sleep(sleepMs);
          processed -= 1;
          cursor = undefined;
          break;
        }

        if (lookup.requestFailed && !lookup.video) {
          failed += 1;
          continue;
        }

        const video = lookup.video;
        if (!video) {
          skipped += 1;
          continue;
        }

        const exactEmbed = videoEmbed(video);
        const exactIframe = videoIframe(video);

        if (!exactEmbed && !exactIframe) {
          await prisma.movie.update({
            where: { id: movie.id },
            data: {
              vibixAvailable: false,
              isPublished: false,
              isCatalogAllowed: false,
              isPublicVisible: false,
              catalogBlockReason: "NO_VERIFIED_VIBIX_PLAYER",
              vibixLastSyncAt: new Date(),
            },
          });
          hidden += 1;
          continue;
        }

        if (samePlayer(movie, video)) {
          skipped += 1;
          continue;
        }

        await prisma.movie.update({
          where: { id: movie.id },
          data: {
            vibixId: intValue(video.id) ?? movie.vibixId,
            vibixType: stringValue(video.type) ?? movie.vibixType,
            vibixIframeUrl: exactIframe,
            vibixEmbedCode: exactEmbed,
            vibixAvailable: true,
            isPublished: true,
            isCatalogAllowed: true,
            isPublicVisible: true,
            catalogBlockReason: null,
            vibixLastSyncAt: new Date(),
          },
        });
        repaired += 1;
      } catch (error) {
        failed += 1;
        console.error(`[repair-vibix-player-embeds] failed ${movie.slug}:`, error instanceof Error ? error.message : error);
      }

      if (DELAY_MS > 0) await sleep(DELAY_MS);
      if (processed % 100 === 0 || processed === total) {
        console.log(`[repair-vibix-player-embeds] processed=${processed}/${total} repaired=${repaired} hidden=${hidden} skipped=${skipped} failed=${failed} rateLimited=${rateLimited}`);
      }
    }
  }

  console.log(JSON.stringify({ ok: true, total, processed, repaired, hidden, skipped, failed, rateLimited }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
