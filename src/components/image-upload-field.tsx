"use client";

import Image from "next/image";
import { useState } from "react";

export function ImageUploadField({ name, label, currentUrl, dark = false }: { name: string; label: string; currentUrl?: string | null; dark?: boolean }) {
  const [preview, setPreview] = useState(currentUrl || "");
  return (
    <div className={`grid gap-2 text-sm font-bold ${dark ? "text-white" : "text-[#333]"}`}>
      <span>{label}</span>
      {preview ? <div className="relative h-32 overflow-hidden rounded-2xl border border-current/10"><Image src={preview} alt={label} fill className="object-cover" unoptimized /></div> : null}
      <input
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={dark ? "rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white" : "rounded-xl border border-[#ddd] bg-white px-3 py-2 text-sm text-[#222]"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result || ""));
          reader.readAsDataURL(file);
        }}
      />
      <span className={`text-xs font-normal ${dark ? "text-[#a1a1aa]" : "text-neutral-500"}`}>JPG, PNG, WEBP или GIF, до 2 МБ.</span>
      {currentUrl ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" name={`${name}Remove`} onChange={(event) => event.target.checked && setPreview("")} /> Удалить текущую обложку</label> : null}
    </div>
  );
}
