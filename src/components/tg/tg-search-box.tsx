"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TgSearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти фильм или сериал"
        className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.06] px-4 text-[16px] text-white outline-none placeholder:text-[#71717a] focus:border-[#e50914]"
      />
      <button className="rounded-2xl bg-[#e50914] px-4 text-sm font-black text-white" type="submit">Найти</button>
    </form>
  );
}
