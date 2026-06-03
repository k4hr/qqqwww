# MARIOFILM

Стартовый проект каталога фильмов/сериалов на Next.js + Prisma + PostgreSQL для деплоя на GitHub + Railway.

## Что уже есть

- Главная страница как кино-каталог.
- Разделы: фильмы, сериалы, мультфильмы, аниме, последние.
- Поиск.
- Страница фильма с постером, описанием, рейтингами, жанрами, актёрами и блоком плеера.
- Заглушка плеера до подключения Alloha.
- Prisma-схема под свою базу фильмов.
- Seed с тестовыми карточками.
- Черновая админка `/admin`.

## Быстрый локальный старт

```bash
npm install
cp .env.example .env
```

В `.env` укажи PostgreSQL `DATABASE_URL`.

```bash
npx prisma db push
npm run db:seed
npm run dev
```

Открыть:

```text
http://localhost:3000
```

## Railway

1. Создай новый GitHub репозиторий `mariofilm`.
2. Залей этот проект в GitHub.
3. В Railway создай новый проект из GitHub repo.
4. Добавь PostgreSQL service.
5. В переменные сервиса сайта добавь:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_NAME=MARIOFILM
NEXT_PUBLIC_SITE_URL=https://твой-домен
ALLOHA_ENABLED=false
```

6. Build command:

```bash
npm run build
```

7. Start command:

```bash
npm run start
```

8. После первого деплоя выполни в Railway shell или временно через deploy command:

```bash
npx prisma db push && npm run db:seed
```

## Как потом подключается Alloha

Сайт не зависит от Alloha. У фильма есть поле `allohaId`. Пока его нет — показывается заглушка. После подключения партнёрского доступа:

- добавляем `ALLOHA_ENABLED=true`;
- добавляем реальные переменные Alloha;
- в `PlayerBlock` меняем `example-player-domain.test` на реальный iframe/API;
- массово заполняем `allohaId` по `kinopoiskId`, `imdbId`, `tmdbId` или `title + year`.

## Следующие этапы разработки

1. Добавить настоящую админку с формой добавления фильмов.
2. Добавить импорт из TMDB.
3. Добавить импорт/обновление рейтингов KP/IMDb.
4. Добавить R2 для сохранения постеров.
5. Добавить sitemap.xml и robots.txt.
6. Добавить SEO-страницы `/genre/[slug]`, `/year/[year]`, `/top`.
7. Добавить Alloha provider.
