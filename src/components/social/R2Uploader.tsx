"use client";
import { useState } from "react";

export function R2Uploader({ kind, inputName = "mediaId", accept }: { kind: "IMAGE" | "VIDEO"; inputName?: string; accept: string }) {
  const [status, setStatus] = useState(""); const [mediaId, setMediaId] = useState(""); const [progress, setProgress] = useState(0);
  async function upload(file: File) {
    setStatus("Подготовка загрузки…"); setProgress(0);
    const presign = await fetch("/api/admin/social/uploads/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size, kind }) });
    const data = await presign.json(); if (!presign.ok) throw new Error(data.error || "Не удалось создать upload URL");
    await new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("PUT", data.uploadUrl); xhr.setRequestHeader("Content-Type", file.type); xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round(event.loaded / event.total * 100)); xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload ${xhr.status}`)); xhr.onerror = () => reject(new Error("Ошибка сети при загрузке")); xhr.send(file); });
    setStatus("Проверка файла…");
    const confirm = await fetch("/api/admin/social/uploads/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: data.mediaId }) });
    const confirmed = await confirm.json(); if (!confirm.ok) throw new Error(confirmed.error || "Не удалось подтвердить файл");
    setMediaId(data.mediaId); setStatus(`Готово: ${file.name}`); setProgress(100);
  }
  return <div className="rounded-xl border border-dashed border-[#bbb] p-4"><input type="hidden" name={inputName} value={mediaId}/><input type="file" accept={accept} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file).catch((error) => setStatus(error.message)); }}/>{status ? <div className="mt-3 text-sm">{status} {progress ? `(${progress}%)` : ""}</div> : null}</div>;
}
