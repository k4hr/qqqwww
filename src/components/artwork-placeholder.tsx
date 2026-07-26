import type { CSSProperties } from "react";
import { Film } from "lucide-react";

const GENERIC_ARTWORK = new Set([
  "/player-poster.webp",
  "/redfilm-cinematic-bg.webp",
  "/redfilm-hero.webp",
]);

export function isGenericRedfilmArtwork(url?: string | null) {
  if (!url?.trim()) return true;
  try {
    return GENERIC_ARTWORK.has(new URL(url, "https://redfilm.win").pathname);
  } catch {
    return false;
  }
}

function titleHue(title: string) {
  let hash = 0;
  for (const character of title) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

export function ArtworkPlaceholder({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  const style = { "--rf-poster-hue": titleHue(title) } as CSSProperties;

  return (
    <div className="rf-artwork-placeholder absolute inset-0 flex flex-col justify-end p-4" style={style}>
      {!compact ? (
        <div className="relative z-10">
          <Film size={24} strokeWidth={1.35} className="text-white/38" />
          <div className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-white/75">{title}</div>
        </div>
      ) : null}
    </div>
  );
}
