import Link from "next/link";
import { createMovieManually } from "../actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewMoviePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="container py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-mario-green">← Назад в админку</Link>
      <h1 className="text-3xl font-bold mt-3 mb-2">Добавить карточку вручную</h1>
      <p className="text-neutral-600 mb-6">Минимум нужны название, год и описание. Остальное можно заполнить позже.</p>
      {error ? <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3">Заполни обязательные поля.</div> : null}

      <form action={createMovieManually} className="bg-white border border-mario-line p-5 grid md:grid-cols-2 gap-4">
        <Field label="Название на русском *" name="titleRu" required />
        <Field label="Оригинальное название" name="titleOriginal" />
        <Field label="Год *" name="year" required type="number" />
        <Select label="Тип" name="type" />
        <Field label="Slug" name="slug" placeholder="можно оставить пустым" />
        <Field label="Качество" name="quality" defaultValue="WEB-DL" />
        <Field label="Страна" name="country" />
        <Field label="Режиссёр" name="director" />
        <Field label="Возраст" name="ageRating" placeholder="6+, 12+, 16+, 18+" />
        <Field label="Длительность, минут" name="duration" type="number" />
        <Field label="Постер URL" name="posterUrl" />
        <Field label="Фон URL" name="backdropUrl" />
        <Field label="Трейлер URL" name="trailerUrl" />
        <Field label="Alloha ID" name="allohaId" />
        <Field label="Kinopoisk ID" name="kinopoiskId" />
        <Field label="IMDb ID" name="imdbId" />
        <Field label="TMDB ID" name="tmdbId" />
        <Field label="КП рейтинг" name="kpRating" />
        <Field label="IMDb рейтинг" name="imdbRating" />
        <Field label="TMDB рейтинг" name="tmdbRating" />
        <div className="md:col-span-2">
          <label className="block text-sm font-bold mb-2">Жанры через запятую</label>
          <input name="genres" className="w-full border border-mario-line h-11 px-3" placeholder="Комедия, Приключения, Семейный" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold mb-2">Актёры через запятую</label>
          <input name="cast" className="w-full border border-mario-line h-11 px-3" placeholder="Имя актёра, Имя актёра" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold mb-2">Описание *</label>
          <textarea name="description" required className="w-full border border-mario-line min-h-36 p-3" />
        </div>
        <button className="md:col-span-2 bg-mario-green text-white font-bold h-12" type="submit">Создать карточку</button>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className="w-full border border-mario-line h-11 px-3" />
    </div>
  );
}

function Select({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{label}</label>
      <select name={name} className="w-full border border-mario-line h-11 px-3 bg-white">
        <option value="MOVIE">Фильм</option>
        <option value="SERIES">Сериал</option>
        <option value="CARTOON">Мультфильм</option>
        <option value="ANIME">Аниме</option>
      </select>
    </div>
  );
}
