export const LINK_GENERATOR_CONTENT_TYPES = ["MOVIE", "SERIES", "CARTOON", "ANIME"] as const;
export type LinkGeneratorContentType = (typeof LINK_GENERATOR_CONTENT_TYPES)[number];

export const LINK_GENERATOR_BUCKETS = ["MIN_1_10", "MIN_11_30", "MIN_31_60", "MIN_61_PLUS"] as const;
export type LinkGeneratorBucket = (typeof LINK_GENERATOR_BUCKETS)[number];

export type LinkGeneratorItem = {
  id: string;
  title: string;
  type: LinkGeneratorContentType;
  duration: number;
  url: string;
};

export type LinkGeneratorStats = Record<LinkGeneratorBucket | "UNKNOWN", number>;
export type LinkGeneratorBucketCounts = Record<LinkGeneratorBucket, number>;

export const LINK_GENERATOR_BUCKET_META: Record<
  LinkGeneratorBucket,
  { title: string; description: string; min: number; max: number | null }
> = {
  MIN_1_10: {
    title: "1–10 минут",
    description: "Короткие мультфильмы, мультсериалы и другие короткие выпуски.",
    min: 1,
    max: 10,
  },
  MIN_11_30: {
    title: "11–30 минут",
    description: "Аниме, короткие сериалы и эпизоды средней продолжительности.",
    min: 11,
    max: 30,
  },
  MIN_31_60: {
    title: "31–60 минут",
    description: "Большинство обычных сериалов и длинных эпизодов.",
    min: 31,
    max: 60,
  },
  MIN_61_PLUS: {
    title: "61+ минут",
    description: "Полнометражные фильмы и особенно длинные эпизоды.",
    min: 61,
    max: null,
  },
};
