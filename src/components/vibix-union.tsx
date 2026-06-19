"use client";

import { usePathname } from "next/navigation";

type Props = {
  publisherId: string;
  adTypes: string;
};

export function VibixUnion({ publisherId, adTypes }: Props) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
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
