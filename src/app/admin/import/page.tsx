import Image from "next/image";
import Link from "next/link";
import { importMovieFromKinopoisk, importMovieFromTmdb } from "../actions";
import { searchKinopoisk } from "@/lib/kinopoisk";
import { searchTmdb } from "@/lib/tmdb";
import { parseContentType } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; q?: string; type?: string; source?: string }> };

export default async function ImportPage({ searchParams }: Props) {
  const { error, q = "", type = "MOVIE", source = "kinopoisk" } = await searchParams;
  const contentType = parseContentType(type);
  let results: Array<{
    source: "kinopoisk" | "tmdb";
    id: string;
    title: string;
    originalTitle: string;
    year: number | null;
    posterUrl: string | null;
    rating?: number | null;
    type?: string;
  }> = [];
  let searchError = "";

  if (q.trim()) {
    try {
      if (source === "tmdb") {
        const tmdbResults = await searchTmdb(q, contentType);
        results = tmdbResults.map((item) => ({
          source: "tmdb",
          id: item.tmdbId,
          title: item.title,
          originalTitle: item.originalTitle,
          year: item.year,
          posterUrl: item.posterUrl,
        }));
      } else {
        const kpResults = await searchKinopoisk(q);
        results = kpResults.map((item) => ({
          source: "kinopoisk",
          id: item.kinopoiskId,
          title: item.title,
          originalTitle: item.originalTitle,
          year: item.year,
          posterUrl: item.posterUrl,
          rating: item.rating,
          type: item.type,
        }));
      }
    } catch (e) {
      searchError = e instanceof Error ? e.message : "Ошибка поиска.";
    }
  }

  return (
    <div className="container py-6">
      <Link href="/admin" className="text-sm text-white/50 hover:text-white">← Назад в админку</Link>
      <h1 className="text-3xl font-bold mt-3 mb-2">Импорт карточек</h1>
      <p className="text-white/60 mb-6">
        Основной вариант — Kinopoisk API: он подтягивает русские названия, постеры, описания, рейтинги КП/IMDb, жанры, актёров и ID. TMDB оставлен как запасной источник.
      </p>

      {error ? <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3">Проверь ID и API-ключ в Railway variables.</div> : null}
      {searchError ? <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3">{searchError}</div> : null}

      <section className="vip-panel p-5 mb-6">
        <h2 className="text-xl font-bold mb-4">Поиск по названию</h2>
        <form className="grid md:grid-cols-[1fr_180px_180px_150px] gap-3" action="/admin/import">
          <input name="q" defaultValue={q} className="rounded-2xl border border-white/10 bg-white/[0.05] h-12 px-4 outline-none" placeholder="Например: Аватар, Интерстеллар, Шрек" />
          <select name="source" defaultValue={source} className="rounded-2xl border border-white/10 bg-[#0b1020] h-12 px-4 outline-none">
            <option value="kinopoisk">Kinopoisk</option>
            <option value="tmdb">TMDB</option>
          </select>
          <select name="type" defaultValue={type} className="rounded-2xl border border-white/10 bg-[#0b1020] h-12 px-4 outline-none">
            <option value="MOVIE">Фильм</option>
            <option value="SERIES">Сериал</option>
            <option value="CARTOON">Мультфильм</option>
            <option value="ANIME">Аниме</option>
          </select>
          <button className="rounded-2xl bg-gradient-to-r from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] font-bold h-12" type="submit">Найти</button>
        </form>
      </section>

      {results.length ? (
        <section className="vip-panel p-5 mb-6">
          <h2 className="text-xl font-bold mb-4">Результаты поиска</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((item) => (
              <div key={`${item.source}-${item.id}`} className="vip-soft-panel p-4 flex gap-4">
                <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-black/30 shrink-0">
                  {item.posterUrl ? <Image src={item.posterUrl} alt={item.title} fill className="object-cover" sizes="80px" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold leading-tight line-clamp-2">{item.title}</div>
                  <div className="text-sm text-white/45 mt-1 line-clamp-1">{item.originalTitle}</div>
                  <div className="text-sm text-white/60 mt-2">{item.year ?? "—"}{item.rating ? ` · КП ${item.rating}` : ""}</div>
                  <form action={item.source === "tmdb" ? importMovieFromTmdb : importMovieFromKinopoisk} className="mt-3 flex gap-2">
                    <input type="hidden" name={item.source === "tmdb" ? "tmdbId" : "kinopoiskId"} value={item.id} />
                    <input type="hidden" name="type" value={item.type || type} />
                    <input type="hidden" name="quality" value="WEB-DL" />
                    <button className="rounded-xl bg-[#c9a86a] text-[#0b1020] px-4 py-2 text-sm font-bold" type="submit">Импорт</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-5">
        <form action={importMovieFromKinopoisk} className="vip-panel p-5 grid md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-xl font-bold">Импорт по Kinopoisk ID</h2>
          <Field label="Kinopoisk ID *" name="kinopoiskId" placeholder="например 301" required />
          <Field label="Качество" name="quality" defaultValue="WEB-DL" />
          <Field label="Alloha ID" name="allohaId" placeholder="можно добавить позже" className="md:col-span-2" />
          <button className="md:col-span-2 rounded-2xl bg-gradient-to-r from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] font-bold h-12" type="submit">Импортировать из Kinopoisk</button>
        </form>

        <form action={importMovieFromTmdb} className="vip-panel p-5 grid md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-xl font-bold">Импорт по TMDB ID</h2>
          <Field label="TMDB ID *" name="tmdbId" placeholder="например 19995" required />
          <div>
            <label className="block text-sm font-bold mb-2 text-white/80">Тип</label>
            <select name="type" className="w-full rounded-2xl border border-white/10 bg-[#0b1020] h-12 px-4 outline-none">
              <option value="MOVIE">Фильм</option>
              <option value="SERIES">Сериал</option>
              <option value="CARTOON">Мультфильм</option>
              <option value="ANIME">Аниме</option>
            </select>
          </div>
          <Field label="Качество" name="quality" defaultValue="WEB-DL" />
          <Field label="Возраст" name="ageRating" placeholder="6+, 12+, 16+, 18+" />
          <Field label="КП рейтинг" name="kpRating" placeholder="можно оставить пустым" />
          <Field label="IMDb рейтинг" name="imdbRating" placeholder="можно оставить пустым" />
          <Field label="Alloha ID" name="allohaId" placeholder="можно добавить позже" className="md:col-span-2" />
          <button className="md:col-span-2 rounded-2xl bg-white/[0.08] border border-white/10 text-white font-bold h-12" type="submit">Импортировать из TMDB</button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, required, placeholder, defaultValue, className = "" }: { label: string; name: string; required?: boolean; placeholder?: string; defaultValue?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-bold mb-2 text-white/80">{label}</label>
      <input name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} className="w-full rounded-2xl border border-white/10 bg-white/[0.05] h-12 px-4 outline-none" />
    </div>
  );
}
