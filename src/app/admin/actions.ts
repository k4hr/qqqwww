"use server";

import { ContentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { getTmdbDetails } from "@/lib/tmdb";
import { getKinopoiskDetails } from "@/lib/kinopoisk";
import { parseContentType } from "@/lib/content";

type MovieInput = {
  titleRu: string;
  titleOriginal?: string;
  description: string;
  year: number;
  type: ContentType;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  country?: string;
  director?: string;
  ageRating?: string;
  quality?: string;
  duration?: number;
  kinopoiskId?: string;
  imdbId?: string;
  tmdbId?: string;
  allohaId?: string;
  kpRating?: number;
  imdbRating?: number;
  tmdbRating?: number;
  genres: string[];
  cast: string[];
  slug?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberOrUndefined(value: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function uniqueSlug(baseSlug: string) {
  const normalizedBase = baseSlug || "movie";
  let slug = normalizedBase;
  let counter = 2;

  while (await prisma.movie.findUnique({ where: { slug } })) {
    slug = `${normalizedBase}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function createMovie(input: MovieInput) {
  const slug = await uniqueSlug(input.slug || `${slugify(input.titleRu)}-${input.year}`);

  return prisma.movie.create({
    data: {
      slug,
      titleRu: input.titleRu,
      titleOriginal: input.titleOriginal || null,
      description: input.description,
      year: input.year,
      type: input.type,
      posterUrl: input.posterUrl || null,
      backdropUrl: input.backdropUrl || null,
      trailerUrl: input.trailerUrl || null,
      country: input.country || null,
      director: input.director || null,
      ageRating: input.ageRating || null,
      quality: input.quality || "WEB-DL",
      duration: input.duration || null,
      kinopoiskId: input.kinopoiskId || null,
      imdbId: input.imdbId || null,
      tmdbId: input.tmdbId || null,
      allohaId: input.allohaId || null,
      kpRating: input.kpRating || null,
      imdbRating: input.imdbRating || null,
      tmdbRating: input.tmdbRating || null,
      genres: {
        create: input.genres.map((name) => ({
          genre: {
            connectOrCreate: {
              where: { slug: slugify(name) },
              create: { name, slug: slugify(name) },
            },
          },
        })),
      },
      cast: {
        create: await Promise.all(
          input.cast.map(async (name, index) => {
            const existing = await prisma.person.findFirst({ where: { nameRu: name } });
            const person = existing ?? (await prisma.person.create({ data: { nameRu: name } }));
            return { person: { connect: { id: person.id } }, sortOrder: index };
          }),
        ),
      },
    },
  });
}

export async function createMovieManually(formData: FormData) {
  const titleRu = text(formData, "titleRu");
  const year = Number(text(formData, "year"));
  const description = text(formData, "description");

  if (!titleRu || !Number.isFinite(year) || !description) {
    redirect("/admin/new?error=required");
  }

  const movie = await createMovie({
    titleRu,
    titleOriginal: text(formData, "titleOriginal"),
    description,
    year,
    type: parseContentType(text(formData, "type")),
    posterUrl: text(formData, "posterUrl"),
    backdropUrl: text(formData, "backdropUrl"),
    trailerUrl: text(formData, "trailerUrl"),
    country: text(formData, "country"),
    director: text(formData, "director"),
    ageRating: text(formData, "ageRating"),
    quality: text(formData, "quality") || "WEB-DL",
    duration: numberOrUndefined(text(formData, "duration")),
    kinopoiskId: text(formData, "kinopoiskId"),
    imdbId: text(formData, "imdbId"),
    tmdbId: text(formData, "tmdbId"),
    allohaId: text(formData, "allohaId"),
    kpRating: numberOrUndefined(text(formData, "kpRating")),
    imdbRating: numberOrUndefined(text(formData, "imdbRating")),
    tmdbRating: numberOrUndefined(text(formData, "tmdbRating")),
    genres: splitList(text(formData, "genres")),
    cast: splitList(text(formData, "cast")),
    slug: text(formData, "slug"),
  });

  revalidatePath("/");
  redirect(`/movie/${movie.slug}`);
}

export async function importMovieFromKinopoisk(formData: FormData) {
  const kinopoiskId = text(formData, "kinopoiskId");

  if (!kinopoiskId) redirect("/admin/import?error=kinopoiskId");

  const normalized = await getKinopoiskDetails(kinopoiskId);
  const movie = await createMovie({
    ...normalized,
    tmdbId: normalized.tmdbId || undefined,
    quality: text(formData, "quality") || "WEB-DL",
    allohaId: text(formData, "allohaId"),
  });

  revalidatePath("/");
  redirect(`/movie/${movie.slug}`);
}

export async function importMovieFromTmdb(formData: FormData) {
  const tmdbId = text(formData, "tmdbId");
  const type = parseContentType(text(formData, "type"));

  if (!tmdbId) redirect("/admin/import?error=tmdbId");

  const normalized = await getTmdbDetails(tmdbId, type);
  const movie = await createMovie({
    ...normalized,
    quality: text(formData, "quality") || "WEB-DL",
    ageRating: text(formData, "ageRating"),
    kpRating: numberOrUndefined(text(formData, "kpRating")),
    imdbRating: numberOrUndefined(text(formData, "imdbRating")),
    allohaId: text(formData, "allohaId"),
  });

  revalidatePath("/");
  redirect(`/movie/${movie.slug}`);
}

export async function toggleMoviePublished(formData: FormData) {
  const id = text(formData, "id");
  const current = text(formData, "isPublished") === "true";
  if (!id) redirect("/admin");

  await prisma.movie.update({ where: { id }, data: { isPublished: !current } });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}
