import { PrismaClient, ContentType } from "@prisma/client";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

const movies = [
  {
    titleRu: "Приключения желтого чемоданчика",
    titleOriginal: "Priklyucheniya zheltogo chemodanchika",
    year: 2026,
    type: ContentType.MOVIE,
    quality: "WEB-DL",
    country: "Россия",
    director: "Денис Гуляр",
    ageRating: "6+",
    duration: 87,
    kpRating: 6.5,
    imdbRating: null,
    posterUrl: "https://placehold.co/420x630/6fbe44/ffffff?text=REDFILM",
    backdropUrl: "https://placehold.co/1280x720/1f1f1f/ffffff?text=REDFILM",
    description:
      "Добрый семейный фильм о приключениях, дружбе и необычном путешествии. Карточка создана как пример для стартовой базы REDFILM.",
    genres: ["Фильм", "Комедия", "Приключения", "Семейный", "Фэнтези"],
    cast: ["Павел Прилучный", "Олег Комаров", "Людмила Артемьева"]
  },
  {
    titleRu: "Мортал Комбат 2",
    titleOriginal: "Mortal Kombat 2",
    year: 2026,
    type: ContentType.MOVIE,
    quality: "WEB-DL",
    country: "США",
    director: "Саймон Маккуойд",
    ageRating: "18+",
    duration: 110,
    kpRating: 6.7,
    imdbRating: 6.1,
    posterUrl: "https://placehold.co/420x630/111111/ffffff?text=MORTAL+KOMBAT+2",
    backdropUrl: "https://placehold.co/1280x720/111111/ffffff?text=MORTAL+KOMBAT+2",
    description:
      "Продолжение истории о бойцах, турнире и противостоянии миров. Здесь будет реальное описание после подключения импорта TMDB/Kinopoisk.",
    genres: ["Фильм", "Боевик", "Фэнтези"],
    cast: ["Карл Урбан", "Джессика Макнами", "Мехкад Брукс"]
  },
  {
    titleRu: "Полиция Чикаго",
    titleOriginal: "Chicago P.D.",
    year: 2014,
    type: ContentType.SERIES,
    quality: "WEB-DL",
    country: "США",
    director: "Дик Вульф",
    ageRating: "16+",
    duration: 43,
    kpRating: 7.8,
    imdbRating: 8.1,
    posterUrl: "https://placehold.co/420x630/263238/ffffff?text=CHICAGO+PD",
    backdropUrl: "https://placehold.co/1280x720/263238/ffffff?text=CHICAGO+PD",
    description:
      "Криминальный сериал о работе полицейского подразделения и сложных расследованиях большого города.",
    genres: ["Сериал", "Криминал", "Драма", "Боевик"],
    cast: ["Джейсон Беги", "Марина Скверциати", "Патрик Джон Флюгер"]
  },
  {
    titleRu: "Шрек",
    titleOriginal: "Shrek",
    year: 2001,
    type: ContentType.CARTOON,
    quality: "BDRip",
    country: "США",
    director: "Эндрю Адамсон",
    ageRating: "6+",
    duration: 90,
    kpRating: 8.2,
    imdbRating: 7.9,
    posterUrl: "https://placehold.co/420x630/6fbe44/ffffff?text=SHREK",
    backdropUrl: "https://placehold.co/1280x720/6fbe44/ffffff?text=SHREK",
    description:
      "Культовый мультфильм о зелёном огре, болтливом осле и сказочном приключении, которое пошло не по плану.",
    genres: ["Мультфильм", "Комедия", "Приключения", "Семейный"],
    cast: ["Майк Майерс", "Эдди Мёрфи", "Кэмерон Диас"]
  },
  {
    titleRu: "Мандалорец и Грогу",
    titleOriginal: "The Mandalorian and Grogu",
    year: 2026,
    type: ContentType.MOVIE,
    quality: "CAMRip",
    country: "США",
    director: "Джон Фавро",
    ageRating: "12+",
    duration: 100,
    kpRating: 7.0,
    imdbRating: 7.5,
    posterUrl: "https://placehold.co/420x630/37474f/ffffff?text=MANDALORIAN",
    backdropUrl: "https://placehold.co/1280x720/37474f/ffffff?text=MANDALORIAN",
    description:
      "Космическое приключение в далёкой галактике. Эта карточка нужна для проверки сетки и SEO-страниц.",
    genres: ["Фильм", "Фантастика", "Приключения"],
    cast: ["Педро Паскаль", "Сигурни Уивер"]
  },
  {
    titleRu: "Графиня",
    titleOriginal: "Grafina",
    year: 2026,
    type: ContentType.SERIES,
    quality: "WEB-DL",
    country: "Россия",
    director: "Не указан",
    ageRating: "16+",
    duration: 50,
    kpRating: 6.9,
    imdbRating: null,
    posterUrl: "https://placehold.co/420x630/1b5e20/ffffff?text=GRAFINA",
    backdropUrl: "https://placehold.co/1280x720/1b5e20/ffffff?text=GRAFINA",
    description:
      "Сериал с интригами, семейными тайнами и драматичными поворотами сюжета.",
    genres: ["Сериал", "Драма"],
    cast: ["Актёр 1", "Актёр 2"]
  }
];

async function main() {
  for (const movie of movies) {
    const slug = `${slugify(movie.titleRu)}-${movie.year}`;
    const createdMovie = await prisma.movie.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        titleRu: movie.titleRu,
        titleOriginal: movie.titleOriginal,
        year: movie.year,
        type: movie.type,
        quality: movie.quality,
        country: movie.country,
        director: movie.director,
        ageRating: movie.ageRating,
        duration: movie.duration,
        kpRating: movie.kpRating ?? undefined,
        imdbRating: movie.imdbRating ?? undefined,
        posterUrl: movie.posterUrl,
        backdropUrl: movie.backdropUrl,
        description: movie.description,
      }
    });

    for (const genreName of movie.genres) {
      const genre = await prisma.genre.upsert({
        where: { name: genreName },
        update: {},
        create: { name: genreName, slug: slugify(genreName) }
      });
      await prisma.movieGenre.upsert({
        where: { movieId_genreId: { movieId: createdMovie.id, genreId: genre.id } },
        update: {},
        create: { movieId: createdMovie.id, genreId: genre.id }
      });
    }

    let sortOrder = 0;
    for (const personName of movie.cast) {
      const person = await prisma.person.upsert({
        where: { id: `${slugify(personName)}-seed` },
        update: {},
        create: { id: `${slugify(personName)}-seed`, nameRu: personName }
      });
      await prisma.movieCast.upsert({
        where: { movieId_personId: { movieId: createdMovie.id, personId: person.id } },
        update: {},
        create: { movieId: createdMovie.id, personId: person.id, sortOrder }
      });
      sortOrder += 1;
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
