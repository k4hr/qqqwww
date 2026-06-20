export function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

export function getMovieFreshnessTimestamp(movie: {
  vibixUploadedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): number {
  return toTimestamp(movie.vibixUploadedAt) || toTimestamp(movie.createdAt) || toTimestamp(movie.updatedAt) || 0;
}
