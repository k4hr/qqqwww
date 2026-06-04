import { ContentType } from "@prisma/client";

export const contentTypeLabels: Record<ContentType, string> = {
  MOVIE: "Фильм",
  SERIES: "Сериал",
  CARTOON: "Мультфильм",
  ANIME: "Аниме",
};

export const contentTypePaths: Record<ContentType, string> = {
  MOVIE: "/movies",
  SERIES: "/series",
  CARTOON: "/cartoons",
  ANIME: "/anime",
};

export function getContentTypePath(type: ContentType) {
  return contentTypePaths[type] ?? "/movies";
}

export function getContentTypeLabel(type: ContentType) {
  return contentTypeLabels[type] ?? "Фильм";
}

export function parseContentType(value: string | null | undefined): ContentType {
  if (value === "SERIES") return ContentType.SERIES;
  if (value === "CARTOON") return ContentType.CARTOON;
  if (value === "ANIME") return ContentType.ANIME;
  return ContentType.MOVIE;
}

export function parseSort(value: string | null | undefined) {
  if (value === "rating") return [{ kpRating: "desc" as const }, { imdbRating: "desc" as const }];
  if (value === "popular") return [{ views: "desc" as const }, { likes: "desc" as const }];
  if (value === "year") return [{ year: "desc" as const }, { createdAt: "desc" as const }];
  return [{ createdAt: "desc" as const }];
}
