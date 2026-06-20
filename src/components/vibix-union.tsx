"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

type Props = {
  publisherId: string;
  adTypes: string;
};

export function VibixUnion({ publisherId, adTypes }: Props) {
  const pathname = usePathname();
  const isMobile = useIsMobile(768);
  const disabled = isMobile || pathname.startsWith("/admin");
  useEffect(() => {
    if (disabled || document.querySelector('script[data-redfilm-vibix-union="true"]')) return;
    const script = document.createElement("script");
    script.src = "https://v-js-menu.run/public/lib.en.min.js";
    script.async = true;
    script.dataset.redfilmVibixUnion = "true";
    document.head.appendChild(script);
  }, [disabled]);
  if (disabled) return null;
  const enabledAdTypes = adTypes
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type && type !== "brand")
    .join(",");

  return (
    <ins
      id="vibix_union"
      data-publisher_id={publisherId}
      data-add_types={enabledAdTypes || "sticker,pcsticker,banners,flyroll"}
    />
  );
}
