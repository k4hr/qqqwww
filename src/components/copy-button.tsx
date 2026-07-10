"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Скопировать" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-white hover:bg-white/10"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Скопировано" : label}
    </button>
  );
}
