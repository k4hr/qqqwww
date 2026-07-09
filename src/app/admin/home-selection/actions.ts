"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ensureHomeSelectionTables,
  updateHomeSelectionSettings,
  type HomeSelectionMode,
} from "@/lib/home-selection";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function returnTo(formData: FormData) {
  const value = text(formData, "returnTo");
  return value.startsWith("/admin") ? value : "/admin/home-selection";
}

function normalizeMode(value: string): HomeSelectionMode {
  return value === "MANUAL" || value === "AUTO" || value === "MIXED" ? value : "MIXED";
}

async function nextPosition() {
  await ensureHomeSelectionTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ max_position: number | null }>>(`SELECT MAX(position) AS max_position FROM redfilm_home_selection_items`);
  return (rows[0]?.max_position ?? 0) + 1;
}

export async function saveHomeSelectionSettings(formData: FormData) {
  await updateHomeSelectionSettings({
    title: text(formData, "title") || "В подборке REDFILM",
    subtitle: text(formData, "subtitle") || null,
    limit: Number(text(formData, "limit")) || 8,
    mode: normalizeMode(text(formData, "mode")),
    isEnabled: checkbox(formData, "isEnabled"),
  });

  revalidatePath("/");
  revalidatePath("/admin/home-selection");
  redirect("/admin/home-selection?saved=1");
}

export async function addHomeSelectionItem(formData: FormData) {
  await ensureHomeSelectionTables();
  const movieId = text(formData, "movieId");
  if (!movieId) redirect(returnTo(formData));

  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } });
  if (!movie) redirect(`${returnTo(formData)}?error=movie_not_found`);

  const position = await nextPosition();
  const id = randomUUID();
  const addedFrom = text(formData, "addedFrom") || "manual";

  await prisma.$executeRaw`
    INSERT INTO redfilm_home_selection_items (id, movie_id, position, is_active, is_pinned, added_from, updated_at)
    VALUES (${id}, ${movieId}, ${position}, true, false, ${addedFrom}, now())
    ON CONFLICT (movie_id) DO UPDATE SET
      is_active = true,
      updated_at = now(),
      added_from = EXCLUDED.added_from
  `;

  revalidatePath("/");
  revalidatePath("/admin/home-selection");
  redirect(`${returnTo(formData)}?added=1`);
}

export async function removeHomeSelectionItem(formData: FormData) {
  await ensureHomeSelectionTables();
  const itemId = text(formData, "itemId");
  if (itemId) {
    await prisma.$executeRaw`DELETE FROM redfilm_home_selection_items WHERE id = ${itemId}`;
  }

  revalidatePath("/");
  revalidatePath("/admin/home-selection");
  redirect("/admin/home-selection?removed=1");
}

export async function toggleHomeSelectionItem(formData: FormData) {
  await ensureHomeSelectionTables();
  const itemId = text(formData, "itemId");
  const field = text(formData, "field");
  const current = text(formData, "current") === "true";
  if (!itemId || !["is_active", "is_pinned"].includes(field)) redirect("/admin/home-selection");

  if (field === "is_active") {
    await prisma.$executeRaw`UPDATE redfilm_home_selection_items SET is_active = ${!current}, updated_at = now() WHERE id = ${itemId}`;
  } else {
    await prisma.$executeRaw`UPDATE redfilm_home_selection_items SET is_pinned = ${!current}, updated_at = now() WHERE id = ${itemId}`;
  }

  revalidatePath("/");
  revalidatePath("/admin/home-selection");
  redirect("/admin/home-selection?updated=1");
}

export async function moveHomeSelectionItem(formData: FormData) {
  await ensureHomeSelectionTables();
  const itemId = text(formData, "itemId");
  const direction = text(formData, "direction") === "down" ? "down" : "up";
  if (itemId) {
    const rows = await prisma.$queryRaw<Array<{ id: string; position: number }>>`
      SELECT id, position
      FROM redfilm_home_selection_items
      ORDER BY is_pinned DESC, position ASC, created_at ASC
    `;
    const index = rows.findIndex((row) => row.id === itemId);
    const swapIndex = direction === "down" ? index + 1 : index - 1;
    const current = rows[index];
    const other = rows[swapIndex];
    if (current && other) {
      await prisma.$transaction([
        prisma.$executeRaw`UPDATE redfilm_home_selection_items SET position = ${other.position}, updated_at = now() WHERE id = ${current.id}`,
        prisma.$executeRaw`UPDATE redfilm_home_selection_items SET position = ${current.position}, updated_at = now() WHERE id = ${other.id}`,
      ]);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/home-selection");
  redirect("/admin/home-selection?moved=1");
}
