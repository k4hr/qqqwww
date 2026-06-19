const bannerSizes = ["300x250", "300x600", "680x200", "680x250", "728x90"] as const;

export type VibixBannerSize = typeof bannerSizes[number];

export function VibixBanner({ size }: { size: VibixBannerSize }) {
  const wide = size.startsWith("680") || size.startsWith("728");
  return (
    <aside className={`${wide ? "hidden md:flex" : "flex"} glass-panel section-glow my-7 min-h-[110px] items-center justify-center overflow-hidden rounded-3xl p-3`} aria-label="Реклама">
      <ins data-pm-b={size} className="block max-w-full" />
    </aside>
  );
}
