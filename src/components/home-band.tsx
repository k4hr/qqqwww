import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { isGenericRedfilmArtwork } from "@/components/artwork-placeholder";

type HomeBandTone = "red" | "violet" | "blue" | "amber" | "neutral";

type Props = {
  children: ReactNode;
  artworkUrl?: string | null;
  artworkAlt?: string;
  tone?: HomeBandTone;
  compact?: boolean;
};

export function HomeBand({ children, artworkUrl, artworkAlt = "", tone = "neutral", compact = false }: Props) {
  const hasArtwork = !isGenericRedfilmArtwork(artworkUrl);
  const style = { "--rf-band-image-opacity": hasArtwork ? 0.34 : 0 } as CSSProperties;

  return (
    <div className={`rf-home-band rf-home-band-${tone} ${compact ? "rf-home-band-compact" : ""}`} style={style}>
      {hasArtwork ? (
        <Image
          src={artworkUrl!}
          alt={artworkAlt}
          fill
          loading="lazy"
          quality={68}
          sizes="100vw"
          className="rf-home-band-image"
        />
      ) : null}
      <div className="rf-home-band-shade" aria-hidden />
      <div className="container relative z-10">{children}</div>
    </div>
  );
}
