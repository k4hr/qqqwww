"use client";

import { useState } from "react";

export function CopyReindexButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white transition hover:bg-[#b80710]"
    >
      {copied ? "Скопировано" : "Скопировать"}
    </button>
  );
}
