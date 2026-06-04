# MARIOFILM

Каталог фильмов/сериалов на Next.js + Prisma + PostgreSQL под GitHub + Railway.

## Что уже есть

- Главная страница как кино-каталог.
- Разделы: фильмы, сериалы, мультфильмы, аниме, последние, ТОП.
- Страницы жанров `/genre/[slug]` и годов `/year/[year]`.
- Поиск.
- Страница фильма с постером, описанием, рейтингами, жанрами, актёрами и блоком плеера.
- Блок плеера: если Alloha не подключен, показывает трейлер YouTube или заглушку.
- Prisma-схема под свою базу фильмов.
- Seed с тестовыми карточками.
- Админка `/admin`.
- Ручное добавление карточки `/admin/new`.
- Импорт карточки из TMDB по ID `/admin/import`.
- Sitemap и robots.

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

1. Залей проект в GitHub.
2. В Railway создай новый проект из GitHub repo.
3. Добавь PostgreSQL service.
4. В переменные сервиса сайта добавь:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_NAME=MARIOFILM
NEXT_PUBLIC_SITE_URL=https://твой-домен
ALLOHA_ENABLED=false
ALLOHA_DOMAIN=
ALLOHA_TOKEN=
TMDB_API_KEY=
KINPOISK_API_KEY=
```

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

После первого деплоя выполни в Railway Shell:

```bash
npx prisma db push && npm run db:seed
```

## TMDB импорт

Чтобы работал `/admin/import`, нужен ключ TMDB:

```env
TMDB_API_KEY=твой_ключ
```

Потом в админке вводишь TMDB ID. Например у Avatar ID `19995`.

## Как потом подключается Alloha

Сайт не зависит от Alloha. У фильма есть поле `allohaId`. Пока его нет — показывается трейлер или заглушка. После подключения партнёрского доступа:

- добавляем `ALLOHA_ENABLED=true`;
- добавляем реальные переменные Alloha;
- в `src/components/player-block.tsx` меняем `example-player-domain.test` на реальный iframe/API;
- массово заполняем `allohaId` по `kinopoiskId`, `imdbId`, `tmdbId` или `title + year`.

## Следующие этапы разработки

1. Добавить полноценный поиск TMDB прямо в админке, а не только импорт по ID.
2. Добавить редактирование уже созданной карточки.
3. Добавить R2 для сохранения постеров к себе.
4. Добавить авторизацию в админку.
5. Добавить проверку Alloha и массовое заполнение `allohaId`.
