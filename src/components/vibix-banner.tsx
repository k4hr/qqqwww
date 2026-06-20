"use client";

import { useIsMobile } from "@/hooks/use-is-mobile";

const bannerSizes = ["300x250", "300x600", "680x200", "680x250", "728x90"] as const;

export type VibixBannerSize = typeof bannerSizes[number];

export function VibixBanner({ size }: { size: VibixBannerSize }) {
  const isMobile = useIsMobile(768);
  if (isMobile) return null;
  const wide = size.startsWith("680") || size.startsWith("728");
  return (
    <aside className={`${wide ? "hidden md:flex" : "flex"} glass-panel section-glow my-7 w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-3xl p-3 md:min-h-[110px]`} aria-label="Реклама">
      <ins data-pm-b={size} className="block h-auto max-w-full overflow-hidden" />
    </aside>
  );
}
