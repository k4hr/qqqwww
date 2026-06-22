import { getVibixAdSettings, getVibixBannerSlot, type VibixBannerSize, type VibixBannerSlotKey } from "@/lib/vibix-ads";

export type { VibixBannerSize, VibixBannerSlotKey };

type Props = {
  slot: VibixBannerSlotKey;
  size?: VibixBannerSize;
};

export async function VibixBanner({ slot, size }: Props) {
  const settings = await getVibixAdSettings();
  const slotConfig = getVibixBannerSlot(settings, slot);

  if (!settings.enabled || !settings.bannersEnabled || !slotConfig.enabled) return null;

  const bannerSize = size || slotConfig.size;
  const wide = bannerSize.startsWith("680") || bannerSize.startsWith("728");
  const deviceClass = slotConfig.desktop && slotConfig.mobile
    ? "flex"
    : slotConfig.desktop
      ? "hidden md:flex"
      : "flex md:hidden";

  return (
    <aside
      className={`${deviceClass} ${wide ? "" : ""} glass-panel section-glow my-7 w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-3xl p-3 md:min-h-[110px]`}
      aria-label="Реклама"
      data-redfilm-ad-slot={slot}
    >
      <ins data-pm-b={bannerSize} className="block h-auto max-w-full overflow-hidden" />
    </aside>
  );
}

export async function VibixFlyrollSlot({ slot }: { slot: string }) {
  const settings = await getVibixAdSettings();
  if (!settings.enabled || !settings.flyrollEnabled || settings.flyrollManualSlot !== slot) return null;
  return <ins data-pm-flyroll="" data-redfilm-flyroll-slot={slot} />;
}
