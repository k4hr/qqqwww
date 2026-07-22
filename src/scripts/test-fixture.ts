import { ContentType, CreatorCollectionStatus, MovieArtworkType, PrismaClient } from "@prisma/client";
import { slugify } from "@/lib/slug";

if (process.env.NODE_ENV === "production" || process.env.REDFILM_ALLOW_TEST_SEED !== "true") {
  throw new Error("Test fixture is disabled. Use NODE_ENV=test and REDFILM_ALLOW_TEST_SEED=true on a disposable database.");
}

const prisma = new PrismaClient();

type FixtureMovie = {
  titleRu: string;
  titleOriginal: string;
  year: number;
  type: ContentType;
  genres: string[];
  description: string;
  duration?: number;
  kpId?: string;
  imdbId?: string;
  tmdbId?: string;
  seasons?: number;
  blocked?: boolean;
  posterOnly?: boolean;
};

const fixtures: FixtureMovie[] = [
  { titleRu: "Железный человек", titleOriginal: "Iron Man", year: 2008, type: ContentType.MOVIE, genres: ["boeviki", "fantastika"], description: "Супергерой, технологии и команда Мстителей.", duration: 126, kpId: "61237", imdbId: "tt0371746", tmdbId: "1726" },
  { titleRu: "Мстители", titleOriginal: "The Avengers", year: 2012, type: ContentType.MOVIE, genres: ["boeviki", "fantastika"], description: "Команда супергероев спасает мир.", duration: 143 },
  { titleRu: "Извне", titleOriginal: "From", year: 2022, type: ContentType.SERIES, genres: ["trillery", "uzhasy", "detektivy"], description: "Жители загадочного города борются за выживание, ищут выход и скрываются от ночных существ.", duration: 50, kpId: "111111", imdbId: "tt9813792", tmdbId: "124364", seasons: 4 },
  { titleRu: "Ходячие мертвецы", titleOriginal: "The Walking Dead", year: 2010, type: ContentType.SERIES, genres: ["trillery", "uzhasy", "dramy"], description: "Выживание людей среди зомби и тайн нового мира.", duration: 48 },
  { titleRu: "Человек-паук", titleOriginal: "Spider-Man", year: 2002, type: ContentType.MOVIE, genres: ["boeviki", "fantastika", "priklyucheniya"], description: "Супергеройское приключение Питера Паркера.", duration: 121, kpId: "838", imdbId: "tt0145487", tmdbId: "557" },
  { titleRu: "Интерстеллар", titleOriginal: "Interstellar", year: 2014, type: ContentType.MOVIE, genres: ["fantastika", "dramy", "priklyucheniya"], description: "Космическая экспедиция и путешествие во времени ради спасения человечества.", duration: 169, kpId: "258687", imdbId: "tt0816692", tmdbId: "157336" },
  { titleRu: "Начало", titleOriginal: "Inception", year: 2010, type: ContentType.MOVIE, genres: ["fantastika", "trillery", "detektivy"], description: "Путешествие во времени по уровням сна и тайнам сознания.", duration: 148 },
  { titleRu: "Гарри Поттер", titleOriginal: "Harry Potter", year: 2001, type: ContentType.MOVIE, genres: ["fentezi", "priklyucheniya", "semeynye"], description: "Юный волшебник начинает обучение в Хогвартсе.", duration: 152, kpId: "689", imdbId: "tt0241527", tmdbId: "671" },
  { titleRu: "Фантастические твари", titleOriginal: "Fantastic Beasts", year: 2016, type: ContentType.MOVIE, genres: ["fentezi", "priklyucheniya"], description: "Волшебный мир, магические существа и тайны.", duration: 133 },
  { titleRu: "Ёлки", titleOriginal: "Yolki", year: 2010, type: ContentType.MOVIE, genres: ["komedii", "semeynye"], description: "Новогодняя комедия о людях из разных городов.", duration: 90, kpId: "464963", imdbId: "tt1782568" },
  { titleRu: "Наруто", titleOriginal: "Naruto", year: 2002, type: ContentType.ANIME, genres: ["anime", "boeviki", "priklyucheniya"], description: "Ниндзя учится, взрослеет и защищает друзей.", duration: 24, seasons: 9 },
  { titleRu: "Шрэк", titleOriginal: "Shrek", year: 2001, type: ContentType.CARTOON, genres: ["komedii", "semeynye", "priklyucheniya"], description: "Сказочное приключение Шрэка, Осла и Фионы.", duration: 90 },
  { titleRu: "Шрэк 2", titleOriginal: "Shrek 2", year: 2004, type: ContentType.CARTOON, genres: ["komedii", "semeynye", "priklyucheniya"], description: "Продолжение сказочного приключения Шрэка и Фионы.", duration: 93 },
  { titleRu: "Пчеловод", titleOriginal: "The Beekeeper", year: 2024, type: ContentType.MOVIE, genres: ["boeviki", "trillery"], description: "Бывший агент и одинокий профессионал мстит преступной организации.", duration: 105 },
  { titleRu: "Джон Уик", titleOriginal: "John Wick", year: 2014, type: ContentType.MOVIE, genres: ["boeviki", "trillery", "kriminal"], description: "Профессиональный убийца и бывший киллер мстит преступному миру.", duration: 101 },
  { titleRu: "Джон Уик 2", titleOriginal: "John Wick: Chapter 2", year: 2017, type: ContentType.MOVIE, genres: ["boeviki", "trillery", "kriminal"], description: "Продолжение истории профессионального убийцы.", duration: 122 },
  { titleRu: "Игра престолов", titleOriginal: "Game of Thrones", year: 2011, type: ContentType.SERIES, genres: ["fentezi", "dramy", "priklyucheniya"], description: "Борьба домов за власть в фэнтезийном мире.", duration: 55 },
  { titleRu: "Дом дракона", titleOriginal: "House of the Dragon", year: 2022, type: ContentType.SERIES, genres: ["fentezi", "dramy", "priklyucheniya"], description: "История дома Таргариенов и борьбы за престол.", duration: 58 },
  { titleRu: "Остров проклятых", titleOriginal: "Shutter Island", year: 2010, type: ContentType.MOVIE, genres: ["trillery", "detektivy", "dramy"], description: "Расследование в закрытой клинике превращается в загадку сознания.", duration: 138 },
  { titleRu: "Один дома", titleOriginal: "Home Alone", year: 1990, type: ContentType.MOVIE, genres: ["komedii", "semeynye"], description: "Семейная рождественская комедия о находчивом мальчике.", duration: 103 },
  { titleRu: "Один дома 2", titleOriginal: "Home Alone 2", year: 1992, type: ContentType.MOVIE, genres: ["komedii", "semeynye"], description: "Продолжение семейной рождественской комедии.", duration: 120 },
  { titleRu: "Заклятие", titleOriginal: "The Conjuring", year: 2013, type: ContentType.MOVIE, genres: ["uzhasy", "trillery"], description: "Исследователи паранормального помогают семье.", duration: 112 },
  { titleRu: "Астрал", titleOriginal: "Insidious", year: 2010, type: ContentType.MOVIE, genres: ["uzhasy", "trillery"], description: "Семья сталкивается с паранормальной угрозой.", duration: 103 },
  { titleRu: "Тестовый фильм без задника", titleOriginal: "Poster Only Test", year: 2025, type: ContentType.MOVIE, genres: ["dramy"], description: "Проверка безопасного REDFILM fallback.", duration: 88, posterOnly: true },
  { titleRu: "Запрещённый тестовый фильм", titleOriginal: "Blocked Test", year: 2025, type: ContentType.MOVIE, genres: ["dramy"], description: "Эта запись не должна попадать в публичные рекомендации.", duration: 95, blocked: true },
];

function fixtureSlug(movie: FixtureMovie) {
  return `test-${slugify(movie.titleRu)}-${movie.year}`;
}

async function seedMovie(movie: FixtureMovie, index: number) {
  const slug = fixtureSlug(movie);
  const saved = await prisma.movie.upsert({
    where: { slug },
    create: {
      slug,
      titleRu: movie.titleRu,
      titleOriginal: movie.titleOriginal,
      description: movie.description,
      year: movie.year,
      type: movie.type,
      duration: movie.duration ?? null,
      country: index % 3 === 0 ? "Россия" : "США",
      quality: "WEB-DL 1080p",
      posterUrl: "/player-poster.webp",
      backdropUrl: movie.posterOnly ? null : "/redfilm-cinematic-bg.webp",
      kinopoiskId: movie.kpId ?? `test-kp-${index + 1}`,
      imdbId: movie.imdbId ?? `tt9${String(index + 1).padStart(6, "0")}`,
      tmdbId: movie.tmdbId ?? `90${String(index + 1).padStart(4, "0")}`,
      vibixIframeUrl: `https://example.invalid/test-player/${index + 1}`,
      vibixAvailable: true,
      vibixSeasonCount: movie.seasons ?? null,
      isPublished: true,
      isCatalogAllowed: !movie.blocked,
      isPublicVisible: !movie.blocked,
      isHomeEligible: !movie.blocked,
      isHeroEligible: !movie.blocked && !movie.posterOnly,
      isTrendingEligible: !movie.blocked,
      kpRating: 7.2 + (index % 8) / 10,
      imdbRating: 7 + (index % 7) / 10,
      kpVotes: 50_000 + index * 1_000,
      imdbVotes: 40_000 + index * 900,
      homeScore: 500 - index,
      trendScore: 450 - index,
      qualityScore: 420 - index,
      popularScore: 400 - index,
    },
    update: {
      titleRu: movie.titleRu,
      titleOriginal: movie.titleOriginal,
      description: movie.description,
      type: movie.type,
      duration: movie.duration ?? null,
      posterUrl: "/player-poster.webp",
      vibixIframeUrl: `https://example.invalid/test-player/${index + 1}`,
      vibixAvailable: true,
      vibixSeasonCount: movie.seasons ?? null,
      isPublished: true,
      isCatalogAllowed: !movie.blocked,
      isPublicVisible: !movie.blocked,
      similarityDirty: true,
    },
  });

  for (const genreSlug of movie.genres) {
    const genre = await prisma.genre.upsert({
      where: { slug: genreSlug },
      create: { slug: genreSlug, name: genreSlug.replaceAll("-", " ") },
      update: {},
    });
    await prisma.movieGenre.upsert({
      where: { movieId_genreId: { movieId: saved.id, genreId: genre.id } },
      create: { movieId: saved.id, genreId: genre.id },
      update: {},
    });
  }

  if (!movie.posterOnly && !movie.blocked) {
    await prisma.movieArtwork.upsert({
      where: { movieId_type_url: { movieId: saved.id, type: MovieArtworkType.BACKDROP, url: "/redfilm-cinematic-bg.webp" } },
      create: { movieId: saved.id, type: MovieArtworkType.BACKDROP, source: "MANUAL", url: "/redfilm-cinematic-bg.webp", width: 1920, height: 1080, aspectRatio: 16 / 9, isPrimary: true },
      update: { width: 1920, height: 1080, aspectRatio: 16 / 9 },
    });
  }
  return saved;
}

async function seedArtworkEdgeCases(movieId: string) {
  await prisma.movieArtwork.upsert({
    where: { movieId_type_url: { movieId, type: MovieArtworkType.BACKDROP, url: "/player-poster.webp" } },
    create: { movieId, type: MovieArtworkType.BACKDROP, source: "TMDB", url: "/player-poster.webp", width: 500, height: 750, aspectRatio: 2 / 3, updatedAt: new Date("2025-01-01") },
    update: { width: 500, height: 750, aspectRatio: 2 / 3, updatedAt: new Date("2025-01-01") },
  });
  await prisma.movieArtwork.upsert({
    where: { movieId_type_url: { movieId, type: MovieArtworkType.BACKDROP, url: "/redfilm-hero.webp" } },
    create: { movieId, type: MovieArtworkType.BACKDROP, source: "LEGACY", url: "/redfilm-hero.webp" },
    update: { width: null, height: null, aspectRatio: null },
  });
}

async function seedCollection(movieIds: string[]) {
  const partner = await prisma.partner.upsert({
    where: { slug: "test-curator" },
    create: { name: "Test Curator", publicName: "Тестовый куратор", slug: "test-curator", login: "test-curator", passwordHash: "test-only-not-a-login", commissionPercent: 10, status: "ACTIVE" },
    update: { status: "ACTIVE", publicName: "Тестовый куратор" },
  });
  const hub = await prisma.creatorHub.upsert({
    where: { slug: "test-curator" },
    create: { partnerId: partner.id, title: "Тестовые подборки", slug: "test-curator", description: "Fixture для HTTP smoke.", isPublished: true },
    update: { partnerId: partner.id, isPublished: true },
  });
  const collection = await prisma.creatorCollection.upsert({
    where: { hubId_slug: { hubId: hub.id, slug: "smoke-collection" } },
    create: { hubId: hub.id, partnerId: partner.id, title: "Smoke collection", slug: "smoke-collection", status: CreatorCollectionStatus.PUBLISHED, publishedAt: new Date() },
    update: { status: CreatorCollectionStatus.PUBLISHED, publishedAt: new Date() },
  });
  for (const [position, movieId] of movieIds.slice(0, 5).entries()) {
    await prisma.creatorCollectionMovie.upsert({
      where: { collectionId_movieId: { collectionId: collection.id, movieId } },
      create: { collectionId: collection.id, movieId, position },
      update: { position },
    });
  }
}

async function main() {
  const movies = [];
  for (const [index, movie] of fixtures.entries()) movies.push(await seedMovie(movie, index));
  await seedArtworkEdgeCases(movies[0].id);
  await seedCollection(movies.map((movie) => movie.id));
  console.log(JSON.stringify({ seededMovies: movies.length, watchSlug: movies[0].slug, partnerSlug: "test-curator", collectionSlug: "smoke-collection" }, null, 2));
}

main().finally(async () => prisma.$disconnect());
