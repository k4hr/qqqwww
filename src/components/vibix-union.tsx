"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = {
  publisherId: string;
  adTypes: string;
  enabled?: boolean;
  scriptUrl?: string;
  flyrollPosition?: number;
};

export function VibixUnion({ publisherId, adTypes, enabled = true, scriptUrl = "https://v-js-menu.run/public/lib.en.min.js", flyrollPosition = 2 }: Props) {
  const pathname = usePathname();
  const disabled = !enabled || !adTypes.trim() || pathname.startsWith("/admin");

  useEffect(() => {
    if (disabled || document.querySelector('script[data-redfilm-vibix-union="true"]')) return;
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.redfilmVibixUnion = "true";
    document.head.appendChild(script);
  }, [disabled, scriptUrl]);

  if (disabled) return null;

  return (
    <ins
      id="vibix_union"
      data-publisher_id={publisherId}
      data-add_types={adTypes}
      data-position={String(flyrollPosition)}
    />
  );
}
