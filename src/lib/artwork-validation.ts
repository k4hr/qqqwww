export const MIN_BACKDROP_RATIO = 1.5;
export const MAX_BACKDROP_RATIO = 2.55;

export type ArtworkDimensions = {
  url: string;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
};

export function isUsefulArtworkUrl(value: string | null | undefined) {
  return Boolean(value?.trim()) && !/^data:/i.test(value ?? "");
}

export function artworkAspectRatio(input: Pick<ArtworkDimensions, "width" | "height" | "aspectRatio">) {
  if (input.width != null && input.height != null && input.height > 0) return input.width / input.height;
  return typeof input.aspectRatio === "number" && Number.isFinite(input.aspectRatio) ? input.aspectRatio : null;
}

export function isWideBackdropArtwork(input: ArtworkDimensions) {
  if (!isUsefulArtworkUrl(input.url)) return false;
  const ratio = artworkAspectRatio(input);
  if (ratio === null || ratio < MIN_BACKDROP_RATIO || ratio > MAX_BACKDROP_RATIO) return false;
  if ((input.width ?? 0) > 0 && input.width! < 780) return false;
  if ((input.height ?? 0) > 0 && input.height! < 360) return false;
  return true;
}

export function isValidPosterArtwork(input: ArtworkDimensions) {
  if (!isUsefulArtworkUrl(input.url)) return false;
  const ratio = artworkAspectRatio(input);
  if (ratio === null || ratio < 0.58 || ratio > 0.78) return false;
  if ((input.width ?? 0) > 0 && input.width! < 300) return false;
  if ((input.height ?? 0) > 0 && input.height! < 450) return false;
  return true;
}

export function isValidLogoArtwork(input: ArtworkDimensions) {
  if (!isUsefulArtworkUrl(input.url)) return false;
  if (input.width == null || input.height == null || input.height <= 0) return false;
  return input.width >= 220 && input.height >= 70;
}
