"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { saveEditorialImageFile } from "@/lib/editorial/image-upload";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function uniqueSlugFromBase(baseValue: string, movieId: string) {
  const base = slugify(baseValue) || `movie-${movieId.slice(0, 8)}`;
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.movie.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === movieId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function revalidateMoviePaths(id: string, oldSlug: string, newSlug: string) {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/films");
  revalidatePath("/series");
  revalidatePath("/anime");
  revalidatePath("/cartoons");
  revalidatePath("/latest");
  revalidatePath("/top");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath("/admin/editorial");
  revalidatePath(`/admin/editorial/${id}`);
  revalidatePath(`/watch/${oldSlug}`);
  revalidatePath(`/watch/${newSlug}`);
  revalidatePath(`/movie/${oldSlug}`);
  revalidatePath(`/movie/${newSlug}`);
  revalidatePath(`/similar/${oldSlug}`);
  revalidatePath(`/similar/${newSlug}`);
}

export async function saveMovieEditorial(formData: FormData) {
  const id = text(formData, "id");
  if (!id) redirect("/admin/editorial?error=missing_id");

  const movie = await prisma.movie.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      titleRu: true,
      year: true,
      editorialSourceTitleRu: true,
      editorialSourceSlug: true,
      editorialPosterUrl: true,
      editorialBackdropUrl: true,
    },
  });

  if (!movie) redirect("/admin/editorial?error=not_found");

  const titleValue = text(formData, "titleRu");
  if (!titleValue) redirect(`/admin/editorial/${id}?error=empty_title`);

  const newSlug = await uniqueSlugFromBase(`${titleValue}-${movie.year}`, movie.id);
  const [editorialPosterUrl, editorialBackdropUrl] = await Promise.all([
    saveEditorialImageFile(formData, "editorialPosterUrl", movie.id, movie.editorialPosterUrl),
    saveEditorialImageFile(formData, "editorialBackdropUrl", movie.id, movie.editorialBackdropUrl),
  ]);

  await prisma.$transaction(async (tx) => {
    if (movie.slug !== newSlug) {
      await tx.movieSlugRedirect.upsert({
        where: { oldSlug: movie.slug },
        create: { oldSlug: movie.slug, movieId: movie.id },
        update: { movieId: movie.id },
      });
    }

    await tx.movie.update({
      where: { id },
      data: {
        titleRu: titleValue,
        slug: newSlug,
        editorialTitleRu: null,
        editorialSourceTitleRu: movie.editorialSourceTitleRu ?? movie.titleRu,
        editorialSourceSlug: movie.editorialSourceSlug ?? movie.slug,
        editorialTitleLocked: true,
        editorialPosterUrl,
        editorialBackdropUrl,
        editorialUpdatedAt: new Date(),
        similarityDirty: true,
        similarityDirtyReason: "editorial_title_change",
      },
    });
  });

  revalidateMoviePaths(id, movie.slug, newSlug);
  redirect(`/admin/editorial/${id}?saved=1&slug=${encodeURIComponent(newSlug)}`);
}

export async function resetMovieEditorial(formData: FormData) {
  const id = text(formData, "id");
  if (!id) redirect("/admin/editorial");

  const movie = await prisma.movie.findUnique({
    where: { id },
    select: {
      slug: true,
      titleRu: true,
      editorialSourceTitleRu: true,
      editorialSourceSlug: true,
    },
  });

  if (!movie) redirect("/admin/editorial");

  const restoredTitle = movie.editorialSourceTitleRu ?? movie.titleRu;
  const desiredSlug = movie.editorialSourceSlug ?? slugify(restoredTitle);
  const restoredSlug = await uniqueSlugFromBase(desiredSlug, id);

  await prisma.$transaction(async (tx) => {
    if (movie.slug !== restoredSlug) {
      await tx.movieSlugRedirect.upsert({
        where: { oldSlug: movie.slug },
        create: { oldSlug: movie.slug, movieId: id },
        update: { movieId: id },
      });
    }

    await tx.movie.update({
      where: { id },
      data: {
        titleRu: restoredTitle,
        slug: restoredSlug,
        editorialTitleRu: null,
        editorialSourceTitleRu: null,
        editorialSourceSlug: null,
        editorialTitleLocked: false,
        editorialPosterUrl: null,
        editorialBackdropUrl: null,
        editorialUpdatedAt: new Date(),
        similarityDirty: true,
        similarityDirtyReason: "editorial_reset",
      },
    });
  });

  revalidateMoviePaths(id, movie.slug, restoredSlug);
  redirect(`/admin/editorial/${id}?reset=1`);
}
