"use client";

import { usePathname } from "next/navigation";

type Props = {
  publisherId: string;
  adTypes: string;
};

export function VibixUnion({ publisherId, adTypes }: Props) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <ins
      id="vibix_union"
      data-publisher_id={publisherId}
      data-add_types={adTypes}
    />
  );
}
