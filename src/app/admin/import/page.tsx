import Link from "next/link";
import { importMovieFromTmdb } from "../actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ImportPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="container py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-mario-green">← Назад в админку</Link>
      <h1 className="text-3xl font-bold mt-3 mb-2">Импорт из TMDB</h1>
      <p className="text-neutral-600 mb-6">
        Введи TMDB ID фильма/сериала. Сайт подтянет название, описание, постер, фон, жанры, актёров, трейлер и рейтинг TMDB.
      </p>
      {error ? <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3">Укажи TMDB ID. Также проверь переменную TMDB_API_KEY в Railway.</div> : null}

      <div className="grid lg:grid-cols-[1fr_380px] gap-5">
        <form action={importMovieFromTmdb} className="bg-white border border-mario-line p-5 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">TMDB ID *</label>
            <input name="tmdbId" required className="w-full border border-mario-line h-11 px-3" placeholder="например 19995" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Тип</label>
            <select name="type" className="w-full border border-mario-line h-11 px-3 bg-white">
              <option value="MOVIE">Фильм</option>
              <option value="SERIES">Сериал</option>
              <option value="CARTOON">Мультфильм</option>
              <option value="ANIME">Аниме</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Качество</label>
            <input name="quality" defaultValue="WEB-DL" className="w-full border border-mario-line h-11 px-3" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Возраст</label>
            <input name="ageRating" placeholder="6+, 12+, 16+, 18+" className="w-full border border-mario-line h-11 px-3" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">КП рейтинг</label>
            <input name="kpRating" className="w-full border border-mario-line h-11 px-3" placeholder="можно оставить пустым" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">IMDb рейтинг</label>
            <input name="imdbRating" className="w-full border border-mario-line h-11 px-3" placeholder="можно оставить пустым" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-2">Alloha ID</label>
            <input name="allohaId" className="w-full border border-mario-line h-11 px-3" placeholder="можно добавить позже" />
          </div>
          <button className="md:col-span-2 bg-mario-green text-white font-bold h-12" type="submit">Импортировать карточку</button>
        </form>

        <div className="bg-[#151515] text-white p-5">
          <h2 className="text-xl font-bold mb-3">Как найти TMDB ID</h2>
          <ol className="space-y-3 text-sm text-white/80 list-decimal list-inside">
            <li>Открой сайт TMDB.</li>
            <li>Найди фильм или сериал.</li>
            <li>В ссылке будет число — это ID.</li>
            <li>Например: /movie/19995-avatar → ID 19995.</li>
          </ol>
          <p className="text-sm text-white/60 mt-5">Позже можно добавить поиск прямо в админке, чтобы не ходить на TMDB вручную.</p>
        </div>
      </div>
    </div>
  );
}
