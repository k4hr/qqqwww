"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CatalogBase } from "@/lib/navigation-data";
import { MegaMenu, type CatalogMenuKind } from "@/components/header/header-menu-data";

type Props = {
  label: string;
  base: CatalogBase;
  kind: CatalogMenuKind;
};

export function HeaderCatalogMenuClient({ label, base, kind }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="inline-flex min-h-11 items-center overflow-hidden rounded-full text-[13px] font-bold text-[#d4d4d8] transition hover:bg-white/[.07] hover:text-white focus-within:bg-white/[.07]">
        <Link href={base} className="px-3 py-2">{label}</Link>
        <button
          type="button"
          aria-label={`Открыть меню: ${label}`}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="true"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-9 items-center justify-center border-l border-white/10 px-2"
        >
          <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
        </button>
      </div>
      {open ? <span aria-hidden className="absolute inset-x-0 top-full h-[18px]" /> : null}
      <div id={id} className={open ? "block" : "hidden"}>
        <MegaMenu base={base} kind={kind} />
      </div>
    </div>
  );
}
