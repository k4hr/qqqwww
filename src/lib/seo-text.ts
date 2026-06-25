import type { Movie } from "@prisma/client";

export function filmIntro(movie: Pick<Movie, "titleRu" | "year" | "quality" | "type"> & { genres?: Array<{ genre: { name: string } }> }) {
  const typeLabel = movie.type === "SERIES" ? "сериал" : movie.type === "ANIME" ? "аниме" : movie.type === "CARTOON" ? "мультфильм" : "фильм";
  const genres = movie.genres?.slice(0, 3).map((item) => item.genre.name.toLowerCase()).join(", ");
  return [
    `«${movie.titleRu}» (${movie.year}) — ${typeLabel}, который можно смотреть онлайн на REDFILM. На странице собраны описание, рейтинги, качество, плеер и быстрые ссылки на похожие подборки.`,
    `Доступное качество: ${movie.quality || "HD"}.${genres ? ` Жанры: ${genres}.` : ""} Ниже находятся похожие фильмы, страницы по году, жанру и стране, чтобы быстро выбрать, что посмотреть дальше.`,
  ];
}

export function whyWatchText(movie: Pick<Movie, "titleRu" | "year" | "kpRating" | "imdbRating" | "type">) {
  const rating = movie.kpRating ?? movie.imdbRating;
  const typeLabel = movie.type === "SERIES" ? "сериал" : movie.type === "ANIME" ? "аниме" : movie.type === "CARTOON" ? "мультфильм" : "фильм";
  return rating
    ? `Этот ${typeLabel} стоит внимания, если вы ищете онлайн-просмотр с нормальным рейтингом: ${rating.toFixed(1)} из 10. REDFILM обновляет карточки, похожие рекомендации и тематические подборки по мере расширения каталога.`
    : `Этот ${typeLabel} добавлен в каталог REDFILM с описанием, постером и плеером. Рекомендации и похожие подборки обновляются автоматически.`;
}

export function similarSeoIntro(movie: Pick<Movie, "titleRu" | "year">) {
  return [
    `Подборка для зрителей, которые ищут фильмы, похожие на «${movie.titleRu}» (${movie.year}). Список учитывает жанры, период выхода, страну, рейтинги и общую тематику.`,
    `Эта страница помогает закрыть запросы вроде «что посмотреть после ${movie.titleRu}» и «фильмы похожие на ${movie.titleRu}». Позиции обновляются вместе с каталогом REDFILM и similarity engine.`,
  ];
}

export function likeSeoIntro(movie: Pick<Movie, "titleRu">) {
  return [
    `Если вам понравился «${movie.titleRu}», продолжить вечер помогут фильмы и сериалы с близким настроением, темами и жанровой основой.`,
    `Здесь акцент сделан не на полном совпадении сюжета, а на том, что логично посмотреть следующим: популярные работы того же формата, периода и атмосферы.`,
  ];
}

export function collectionSeoIntro(baseTitle: string, count: number) {
  return `Все доступные части серии «${baseTitle}» собраны в порядке выхода. В подборке ${count} ${count === 2 ? "части" : "частей"}: можно сравнить годы, описания и перейти к просмотру каждой картины.`;
}
