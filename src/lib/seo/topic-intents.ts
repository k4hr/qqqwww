const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function normalizeSeoQuery(query: string) {
  return query.toLowerCase().replaceAll("ё", "е").replace(/[«»“”„"']/g, "").replace(/\s+/g, " ").trim();
}

function slugifyRu(value: string) {
  return normalizeSeoQuery(value).split("").map((char) => CYR_TO_LAT[char] ?? char).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export type SeoTopicKey =
  | "WAR_WW2"
  | "WAR_SCOUTS"
  | "WAR_SABOTEURS"
  | "WAR_PARTISANS"
  | "WAR_TANKS"
  | "WAR_SNIPERS"
  | "WAR_SERIALS";

export type SeoTopicCluster = {
  key: string;
  targetSlug: string;
  intent: "WAR_TOPIC";
  targetType: "WAR_COLLECTION";
  title: string;
  mainQuery: string;
  topicKey: SeoTopicKey;
};

const WW2_MARKERS = /1941\s*(?:-|–|—|по|до)?\s*1945|1941\s+1945|вов\b|велик[а-я]+\s+отечествен|втор[а-я]+\s+миров|про\s+войн|военн(?:ое|ые|ый|ая|ого|ых)?\s+(?:кино|фильм|фильмы|сериал|сериалы)|войн[аеуы]|фронт|фашист|немц[ыаев]?|оккупац|партизан|разведчик|разведк|диверсант|танкист|снайпер/i;

const TOPICS: Array<{
  key: SeoTopicKey;
  slug: string;
  title: string;
  mainQuery: string;
  pattern: RegExp;
  terms: string[];
}> = [
  {
    key: "WAR_SERIALS",
    slug: "serialy-pro-voynu-1941-1945",
    title: "Сериалы про войну 1941–1945",
    mainQuery: "сериалы про войну 1941 1945",
    pattern: /сериал|сериалы/i,
    terms: ["война", "военный", "фронт", "1941", "1945", "великая отечественная", "вторая мировая"],
  },
  {
    key: "WAR_SCOUTS",
    slug: "filmy-pro-razvedchikov-1941-1945",
    title: "Фильмы про разведчиков 1941–1945",
    mainQuery: "фильмы про разведчиков 1941 1945",
    pattern: /разведчик|разведк/i,
    terms: ["разведчик", "разведка", "военный", "война", "фронт", "1941", "1945"],
  },
  {
    key: "WAR_SABOTEURS",
    slug: "filmy-pro-diversantov-1941-1945",
    title: "Фильмы про диверсантов 1941–1945",
    mainQuery: "фильмы про диверсантов 1941 1945",
    pattern: /диверсант|диверси/i,
    terms: ["диверсант", "диверсия", "военный", "война", "фронт", "1941", "1945"],
  },
  {
    key: "WAR_PARTISANS",
    slug: "filmy-pro-partizan-1941-1945",
    title: "Фильмы про партизан 1941–1945",
    mainQuery: "фильмы про партизан 1941 1945",
    pattern: /партизан/i,
    terms: ["партизан", "оккупация", "военный", "война", "фронт", "1941", "1945"],
  },
  {
    key: "WAR_TANKS",
    slug: "filmy-pro-tankistov-1941-1945",
    title: "Фильмы про танкистов 1941–1945",
    mainQuery: "фильмы про танкистов 1941 1945",
    pattern: /танкист|танк/i,
    terms: ["танкист", "танк", "военный", "война", "фронт", "1941", "1945"],
  },
  {
    key: "WAR_SNIPERS",
    slug: "filmy-pro-snayperov-1941-1945",
    title: "Фильмы про снайперов 1941–1945",
    mainQuery: "фильмы про снайперов 1941 1945",
    pattern: /снайпер/i,
    terms: ["снайпер", "военный", "война", "фронт", "1941", "1945"],
  },
  {
    key: "WAR_WW2",
    slug: "filmy-pro-voynu-1941-1945",
    title: "Фильмы про войну 1941–1945",
    mainQuery: "фильмы про войну 1941 1945",
    pattern: WW2_MARKERS,
    terms: ["война", "военный", "фронт", "фашист", "немец", "1941", "1945", "великая отечественная", "вторая мировая"],
  },
];

export function detectWarTopic(query: string): SeoTopicCluster | null {
  const normalized = normalizeSeoQuery(query);
  if (/звездн[а-я]* войн|star wars|войны клонов|warcraft/i.test(normalized)) return null;
  if (!WW2_MARKERS.test(normalized)) return null;
  const topic = TOPICS.find((item) => item.pattern.test(normalized)) ?? TOPICS[TOPICS.length - 1];
  return {
    key: topic.slug,
    targetSlug: topic.slug,
    intent: "WAR_TOPIC",
    targetType: "WAR_COLLECTION",
    title: topic.title,
    mainQuery: topic.mainQuery,
    topicKey: topic.key,
  };
}

export function getWarTopicTerms(topicKey: string | null | undefined) {
  const topic = TOPICS.find((item) => item.key === topicKey) ?? TOPICS[TOPICS.length - 1];
  return topic.terms;
}

export function getWarTopicBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  return TOPICS.find((item) => item.slug === slug || item.slug === slugifyRu(slug)) ?? null;
}
