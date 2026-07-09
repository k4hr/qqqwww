import { type Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HomeSelectionMode = "MANUAL" | "AUTO" | "MIXED";

export type HomeSelectionSettings = {
  singletonKey: string;
  title: string;
  subtitle: string | null;
  limit: number;
  mode: HomeSelectionMode;
  isEnabled: boolean;
};

export type HomeSelectionItem = {
  id: string;
  movieId: string;
  position: number;
  isActive: boolean;
  isPinned: boolean;
  note: string | null;
  addedFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
  movie: Movie;
};

const DEFAULT_SETTINGS: HomeSelectionSettings = {
  singletonKey: "default",
  title: "В подборке REDFILM",
  subtitle: "Ручная витрина главной страницы",
  limit: 8,
  mode: "MIXED",
  isEnabled: true,
};

let tablesReady = false;

function normalizeMode(value: unknown): HomeSelectionMode {
  return value === "MANUAL" || value === "AUTO" || value === "MIXED" ? value : DEFAULT_SETTINGS.mode;
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.limit;
  return Math.max(1, Math.min(Math.trunc(parsed), 24));
}

export async function ensureHomeSelectionTables() {
  if (tablesReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS redfilm_home_selection_settings (
      singleton_key TEXT PRIMARY KEY DEFAULT 'default',
      title TEXT NOT NULL DEFAULT 'В подборке REDFILM',
      subtitle TEXT,
      limit_count INTEGER NOT NULL DEFAULT 8,
      mode TEXT NOT NULL DEFAULT 'MIXED',
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS redfilm_home_selection_items (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL REFERENCES "Movie"("id") ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      note TEXT,
      added_from TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(movie_id)
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS redfilm_home_selection_items_active_position_idx ON redfilm_home_selection_items (is_active, is_pinned, position)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS redfilm_home_selection_items_movie_idx ON redfilm_home_selection_items (movie_id)`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO redfilm_home_selection_settings (singleton_key, title, subtitle, limit_count, mode, is_enabled)
    VALUES ('default', 'В подборке REDFILM', 'Ручная витрина главной страницы', 8, 'MIXED', true)
    ON CONFLICT (singleton_key) DO NOTHING
  `);

  tablesReady = true;
}

type RawSettingsRow = {
  singleton_key: string;
  title: string;
  subtitle: string | null;
  limit_count: number;
  mode: string;
  is_enabled: boolean;
};

function mapSettings(row?: RawSettingsRow | null): HomeSelectionSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    singletonKey: row.singleton_key,
    title: row.title || DEFAULT_SETTINGS.title,
    subtitle: row.subtitle,
    limit: normalizeLimit(row.limit_count),
    mode: normalizeMode(row.mode),
    isEnabled: Boolean(row.is_enabled),
  };
}

export async function getHomeSelectionSettings() {
  await ensureHomeSelectionTables();
  const rows = await prisma.$queryRawUnsafe<RawSettingsRow[]>(`
    SELECT singleton_key, title, subtitle, limit_count, mode, is_enabled
    FROM redfilm_home_selection_settings
    WHERE singleton_key = 'default'
    LIMIT 1
  `);
  return mapSettings(rows[0]);
}

export async function updateHomeSelectionSettings(input: {
  title: string;
  subtitle?: string | null;
  limit: number;
  mode: HomeSelectionMode;
  isEnabled: boolean;
}) {
  await ensureHomeSelectionTables();
  const title = input.title.trim() || DEFAULT_SETTINGS.title;
  const subtitle = input.subtitle?.trim() || null;
  const limit = normalizeLimit(input.limit);
  const mode = normalizeMode(input.mode);

  await prisma.$executeRaw`
    INSERT INTO redfilm_home_selection_settings (singleton_key, title, subtitle, limit_count, mode, is_enabled, updated_at)
    VALUES ('default', ${title}, ${subtitle}, ${limit}, ${mode}, ${input.isEnabled}, now())
    ON CONFLICT (singleton_key) DO UPDATE SET
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      limit_count = EXCLUDED.limit_count,
      mode = EXCLUDED.mode,
      is_enabled = EXCLUDED.is_enabled,
      updated_at = now()
  `;
}

export async function getHomeSelectionItems(limit?: number) {
  await ensureHomeSelectionTables();
  const settings = await getHomeSelectionSettings();
  const take = normalizeLimit(limit ?? settings.limit);

  const rows = await prisma.$queryRawUnsafe<Array<{
    item_id: string;
    movie_id: string;
    position: number;
    is_active: boolean;
    is_pinned: boolean;
    note: string | null;
    added_from: string | null;
    item_created_at: Date;
    item_updated_at: Date;
  }>>(`
    SELECT
      id AS item_id,
      movie_id,
      position,
      is_active,
      is_pinned,
      note,
      added_from,
      created_at AS item_created_at,
      updated_at AS item_updated_at
    FROM redfilm_home_selection_items
    ORDER BY is_pinned DESC, position ASC, created_at ASC
    LIMIT ${Math.max(take, 100)}
  `);

  const movies = await prisma.movie.findMany({
    where: { id: { in: rows.map((row) => row.movie_id) } },
  });
  const movieMap = new Map(movies.map((movie) => [movie.id, movie]));

  return rows
    .map((row) => {
      const movie = movieMap.get(row.movie_id);
      if (!movie) return null;
      return {
        id: row.item_id,
        movieId: row.movie_id,
        position: row.position,
        isActive: row.is_active,
        isPinned: row.is_pinned,
        note: row.note,
        addedFrom: row.added_from,
        createdAt: row.item_created_at,
        updatedAt: row.item_updated_at,
        movie,
      } satisfies HomeSelectionItem;
    })
    .filter(Boolean) as HomeSelectionItem[];
}

export async function getHomeSelectionForHero() {
  const settings = await getHomeSelectionSettings();
  if (!settings.isEnabled || settings.mode === "AUTO") return { settings, movies: [] as Movie[] };

  const items = await getHomeSelectionItems(settings.limit);
  const movies = items
    .filter((item) => item.isActive)
    .map((item) => item.movie)
    .filter((movie) => movie.isPublished && movie.isCatalogAllowed)
    .slice(0, settings.limit);

  return { settings, movies };
}

export async function getHomeSelectionMovieIds() {
  await ensureHomeSelectionTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ movie_id: string }>>(`SELECT movie_id FROM redfilm_home_selection_items`);
  return new Set(rows.map((row) => row.movie_id));
}

export async function getPopularMoviesFromAnalytics(days = 7, limit = 20) {
  const since = new Date(Date.now() - Math.max(1, days) * 86_400_000);
  const rows = await prisma.movieEvent.groupBy({
    by: ["movieId", "type"],
    where: { movieId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const weights: Record<string, number> = {
    page_view: 1,
    player_view: 3,
    watch_click: 2,
    card_click: 2,
    similar_click: 1,
  };
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (!row.movieId) continue;
    scores.set(row.movieId, (scores.get(row.movieId) ?? 0) + row._count._all * (weights[row.type] ?? 0));
  }

  const rankedIds = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Math.min(limit, 50)));
  const movies = await prisma.movie.findMany({ where: { id: { in: rankedIds.map(([id]) => id) } } });
  const movieMap = new Map(movies.map((movie) => [movie.id, movie]));

  return rankedIds
    .map(([id, score]) => {
      const movie = movieMap.get(id);
      return movie ? { movie, score } : null;
    })
    .filter(Boolean) as Array<{ movie: Movie; score: number }>;
}
