"use client";

import Image from "next/image";
import { useState } from "react";

export function EditorialImageField({ name, label, currentUrl, aspect }: { name: string; label: string; currentUrl?: string | null; aspect: "poster" | "backdrop" }) {
  const [preview, setPreview] = useState(currentUrl || "");
  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold text-[#222]">{label}</span>
      {preview ? (
        <div className={`relative overflow-hidden rounded-xl border border-[#ddd] bg-[#111] ${aspect === "poster" ? "aspect-[2/3] max-w-[220px]" : "aspect-video w-full"}`}>
          <Image src={preview} alt="" fill unoptimized className="object-cover" />
        </div>
      ) : null}
      <input
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="rounded-xl border border-[#ddd] bg-white px-3 py-2 text-sm text-[#222]"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result || ""));
          reader.readAsDataURL(file);
        }}
      />
      <span className="text-xs text-neutral-500">JPG, PNG, WEBP или GIF, до 8 МБ.</span>
      {currentUrl ? (
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
          <input type="checkbox" name={`${name}Remove`} onChange={(event) => event.target.checked && setPreview("")} />
          Сбросить ручное изображение и снова использовать источник
        </label>
      ) : null}
    </div>
  );
}
