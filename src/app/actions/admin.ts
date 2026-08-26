"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function updateDishAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precioRaw = String(formData.get("precio") ?? "").trim();
  const disponible = formData.get("disponible") === "on";
  const destacado = formData.get("destacado") === "on";
  const incluyeGuarnicion = formData.get("incluyeGuarnicion") === "on";
  if (!id || !nombre) throw new Error("Faltan datos");
  await prisma.dish.update({
    where: { id },
    data: {
      nombre,
      descripcion,
      precio: precioRaw === "" ? null : Number(precioRaw),
      disponible,
      destacado,
      incluyeGuarnicion,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function uploadDishPhotoAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!id || !(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona una imagen");
  }
  const ext = extname(file.name).toLowerCase() || ".jpg";
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `${id}-${Date.now()}${ext}`;
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));
  await prisma.dish.update({
    where: { id },
    data: { foto: `/uploads/${filename}` },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateIngredientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const stockMinimo = Number(formData.get("stockMinimo"));
  if (!id || !nombre || Number.isNaN(stockMinimo)) throw new Error("Datos inválidos");
  await prisma.ingredient.update({
    where: { id },
    data: { nombre, stockMinimo },
  });
  revalidatePath("/admin");
  revalidatePath("/inventario");
}

const recipeSchema = z.object({
  dishId: z.string().min(1),
  tiempoPreparacion: z.coerce.number().int().min(0).nullable(),
  pasos: z.array(z.string().min(1)),
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      cantidad: z.coerce.number().positive(),
    }),
  ),
});

export async function saveRecipeAction(raw: unknown) {
  await requireAdmin();
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  const { dishId, tiempoPreparacion, pasos, items } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.upsert({
      where: { dishId },
      create: {
        dishId,
        porcionesQueRinde: 1,
        tiempoPreparacion,
        pasos,
      },
      update: { tiempoPreparacion, pasos },
    });
    await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    if (items.length) {
      await tx.recipeIngredient.createMany({
        data: items.map((i) => ({
          recipeId: recipe.id,
          ingredientId: i.ingredientId,
          cantidad: i.cantidad,
        })),
      });
    }
  });
  revalidatePath("/cocina");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "COMIDA");
  const esInterna = formData.get("esInterna") === "on";
  const orden = Number(formData.get("orden") ?? 50);
  if (!id || !nombre) throw new Error("Faltan datos");
  await prisma.category.create({
    data: {
      id,
      nombre,
      tipo: tipo === "BEBIDA" ? "BEBIDA" : "COMIDA",
      esInterna,
      orden,
    },
  });
  revalidatePath("/admin");
}

export async function createDishAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const precioRaw = String(formData.get("precio") ?? "").trim();
  if (!id || !nombre || !categoryId) throw new Error("Faltan datos");
  await prisma.dish.create({
    data: {
      id,
      nombre,
      categoryId,
      precio: precioRaw === "" ? null : Number(precioRaw),
      foto: `/images/placeholders/${categoryId}.svg`,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createIngredientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidadMedida = String(formData.get("unidadMedida") ?? "G");
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);
  if (!id || !nombre) throw new Error("Faltan datos");
  const unidad =
    unidadMedida === "ML" || unidadMedida === "UD" ? unidadMedida : "G";
  await prisma.ingredient.create({
    data: {
      id,
      nombre,
      unidadMedida: unidad,
      stockMinimo,
      stockActual: stockMinimo,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/inventario");
}
