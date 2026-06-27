import { ContentType, type Prisma } from "@prisma/client";
import { calculateCatalogScore } from "@/lib/catalog-score";
import { calculateHomeQuality } from "@/lib/home-quality-score";
import { prisma } from "@/lib/prisma";

export type ForcedAnimeResult = {
  requested: number;
  found: number;
  moved: number;
  alreadyAnime: number;
  examples: Array<{ title: string; year: number; slug: string }>;
};

type ForceAnimeMovie = Prisma.MovieGetPayload<{ include: { genres: { include: { genre: true } } } }>;

function uniqTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

async function forceOneMovieToAnime(movie: ForceAnimeMovie, reason: string) {
  const tags = uniqTags([...(movie.vibixTags ?? []), "anime", "аниме"]);
  const typedMovie = {
    ...movie,
    type: ContentType.ANIME,
    vibixTags: tags,
    isCatalogAllowed: true,
    isPublished: true,
  };
  const homeScore = calculateHomeQuality(typedMovie);
  const catalogScore = calculateCatalogScore(typedMovie);

  await prisma.movie.update({
    where: { id: movie.id },
    data: {
      type: ContentType.ANIME,
      vibixTags: tags,
      isPublished: true,
      isCatalogAllowed: true,
      catalogBlockReason: null,
      catalogCheckedAt: new Date(),
      // Ручное админское действие должно сразу выводить тайтл в /anime.
      // Обычный скоринг может прятать новые Vibix-тайтлы из-за нулевых голосов/рейтинга,
      // но после ручного импорта это ломает ожидаемое поведение админки.
      ...homeScore,
      ...catalogScore,
      catalogScore: Math.max(catalogScore.catalogScore, 60),
      freshScore: Math.max(catalogScore.freshScore, 55),
      popularScore: Math.max(catalogScore.popularScore, 45),
      isPublicVisible: true,
      isFreshEligible: true,
      lastQualitySyncAt: new Date(),
      lastCatalogScoreAt: new Date(),
      similarityDirty: true,
      similarityDirtyReason: reason,
    },
  });
}

export async function forceMoviesToAnimeByIds(movieIds: string[], reason = "admin_force_anime"): Promise<ForcedAnimeResult> {
  const ids = Array.from(new Set(movieIds.filter(Boolean))).slice(0, 1000);
  const result: ForcedAnimeResult = { requested: ids.length, found: 0, moved: 0, alreadyAnime: 0, examples: [] };
  if (!ids.length) return result;

  const movies = await prisma.movie.findMany({
    where: { id: { in: ids } },
    include: { genres: { include: { genre: true } } },
  });
  result.found = movies.length;

  for (const movie of movies) {
    if (movie.type === ContentType.ANIME && movie.isPublicVisible && movie.isCatalogAllowed) {
      result.alreadyAnime += 1;
      continue;
    }
    await forceOneMovieToAnime(movie, reason);
    result.moved += 1;
    if (result.examples.length < 12) result.examples.push({ title: movie.titleRu, year: movie.year, slug: movie.slug });
  }

  return result;
}

export async function forceMovieToAnimeById(movieId: string, reason = "admin_force_anime") {
  const result = await forceMoviesToAnimeByIds([movieId], reason);
  return result;
}
