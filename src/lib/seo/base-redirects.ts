const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function normalizeSeoQuery(query: string) {
  return String(query ?? "").toLowerCase().replaceAll("ё", "е").replace(/[«»“”„"']/g, "").replace(/\s+/g, " ").trim();
}

function slugifyRu(value: string) {
  return normalizeSeoQuery(value).split("").map((char) => CYR_TO_LAT[char] ?? char).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export type SeoBaseRedirectTarget = {
  slug: string;
  path: string;
  title: string;
  mainQuery: string;
};

const GENERIC_WORDS = new Set([
  "смотреть",
  "смотри",
  "смотрим",
  "смотря",
  "посмотреть",
  "онлайн",
  "online",
  "бесплатно",
  "бесплатный",
  "бесплатные",
  "без",
  "регистрации",
  "качество",
  "качестве",
  "хорошем",
  "хорошее",
  "хорошего",
  "лучшее",
  "hd",
  "fullhd",
  "full",
  "1080",
  "1080p",
  "720",
  "720p",
  "фильм",
  "фильмы",
  "кино",
  "сериал",
  "сериалы",
  "мультфильм",
  "мультфильмы",
  "мультик",
  "мультики",
  "аниме",
  "новинки",
  "новинка",
  "популярное",
  "популярные",
  "лучшие",
  "топ",
  "подборки",
  "подборка",
  "в",
  "на",
  "и",
]);

const GENERIC_PATTERNS = [
  /\bсмотреть\b/g,
  /\bсмотри(?:м|те)?\b/g,
  /\bсмотря\b/g,
  /\bпосмотреть\b/g,
  /\bонлайн\b/g,
  /\bonline\b/g,
  /\bбесплатн\w*\b/g,
  /\bбез\s+регистрации\b/g,
  /\b(?:в\s+)?хорош(?:ем|ее|его)?\s+качеств\w*\b/g,
  /\bкачеств\w*\b/g,
  /\b(?:hd|fullhd|1080p?|720p?)\b/g,
  /\bфильм(?:ы|ов|а)?\b/g,
  /\bкино\b/g,
  /\bсериал(?:ы|ов|а)?\b/g,
  /\bмультфильм(?:ы|ов|а)?\b/g,
  /\bмультик(?:и|ов|а)?\b/g,
  /\bаниме\b/g,
  /\bновинк\w*\b/g,
  /\bпопулярн\w*\b/g,
  /\bлучш\w*\b/g,
  /\bтоп\b/g,
  /\bподборк\w*\b/g,
  /\b(?:redfilm|редфильм|lordfilm|лордфильм)\b/g,
  /\b(?:в|на|и|с|по|для)\b/g,
];

function cleanGenericRemainder(query: string) {
  let value = normalizeSeoQuery(query).replace(/[-_/]+/g, " ");
  for (const pattern of GENERIC_PATTERNS) value = value.replace(pattern, " ");
  return value
    .replace(/[^a-zа-я0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTopicOrEntity(query: string) {
  const normalized = normalizeSeoQuery(query);
  if (/\bпро\s+[a-zа-я0-9]+/i.test(normalized)) return true;
  if (/похож|что посмотреть|если понравил|после просмотра|с участием|фильмы с |сериалы с /i.test(normalized)) return true;
  if (/\b([1-9]|1[0-9]|2[0-5])\s*(?:й|-й)?\s*(сезон|сезона)\b/i.test(normalized)) return true;
  const remainder = cleanGenericRemainder(normalized);
  if (!remainder) return false;
  const semanticWords = remainder.split(/\s+/).filter((word) => word.length > 1 && !GENERIC_WORDS.has(word));
  return semanticWords.length > 0;
}

function targetByQuery(query: string): SeoBaseRedirectTarget | null {
  const normalized = normalizeSeoQuery(query).replace(/[-_/]+/g, " ");
  if (!normalized) return null;

  if (/\bподборк\w*\b|\bpodborki\b|\bcollections\b/.test(normalized)) return { slug: "podborki", path: "/collections", title: "Подборки", mainQuery: "подборки" };
  if (/\bновинк\w*\b|\bnovinki\b|\blatest\b/.test(normalized)) return { slug: "novinki", path: "/latest", title: "Новинки", mainQuery: "новинки" };
  if (/\bтоп\b|\btop\b|\bpopular\b|\bpopularnoe\b|\bпопулярн\w*\b|\bлучш\w*\b/.test(normalized)) return { slug: "popularnoe", path: "/popular", title: "Популярное", mainQuery: "популярное" };
  if (/\bаниме\b|\banime\b/.test(normalized)) return { slug: "anime", path: "/anime", title: "Аниме", mainQuery: "аниме" };
  if (/\bмультфильм\w*\b|\bмультик\w*\b|\bmultfilmy\b|\bmultiki\b|\bcartoons\b/.test(normalized)) return { slug: "multfilmy", path: "/cartoons", title: "Мультфильмы", mainQuery: "мультфильмы" };
  if (/\bсериал\w*\b|\bserialy\b|\bseries\b/.test(normalized)) return { slug: "serialy", path: "/series", title: "Сериалы", mainQuery: "сериалы" };
  if (/\bфильм\w*\b|\bкино\b|\bсмотреть\b|\bонлайн\b|\bбесплатн\w*\b|\bкачеств\w*\b|\bfilmy\b|\bfilms\b|\bkino\b|\bsmotret\b/.test(normalized)) return { slug: "filmy", path: "/films", title: "Фильмы", mainQuery: "фильмы" };

  return null;
}

export function baseRedirectForSeoQuery(query: string): SeoBaseRedirectTarget | null {
  const normalized = normalizeSeoQuery(query);
  if (!normalized) return null;
  if (hasTopicOrEntity(normalized)) return null;
  return targetByQuery(normalized);
}

export function baseRedirectForCollectionSlug(slug: string): string | null {
  const normalizedSlug = slugifyRu(slug);
  const query = normalizeSeoQuery(slug.replace(/-/g, " "));
  if (!query) return null;

  // Не трогаем настоящие тематические SEO-подборки.
  if (/^(filmy|serialy|multiki|multfilmy|anime)-pro-/.test(normalizedSlug)) return null;
  if (/^(pohozhie-na|chto-posmotret|filmy-s)-/.test(normalizedSlug)) return null;
  if (/(marvel|garri-potter|forsazh|vlastelin|terminator|chuzhoy|pila|chelovek-pauk)/.test(normalizedSlug)) return null;

  const target = baseRedirectForSeoQuery(query) ?? targetByQuery(query);
  return target?.path ?? null;
}
