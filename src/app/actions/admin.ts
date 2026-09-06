"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { wouldCreateCycle } from "@/lib/prep-recipe";
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
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidadMedidaRaw = String(formData.get("unidadMedida") ?? "");
  const stockActual = Number(formData.get("stockActual"));
  const stockMinimo = Number(formData.get("stockMinimo"));
  if (
    !id ||
    !nombre ||
    Number.isNaN(stockActual) ||
    Number.isNaN(stockMinimo)
  ) {
    throw new Error("Datos inválidos");
  }
  const unidadMedida =
    unidadMedidaRaw === "ML" || unidadMedidaRaw === "UD" ? unidadMedidaRaw : "G";
  const before = await prisma.ingredient.findUnique({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.ingredient.update({
      where: { id },
      data: { nombre, unidadMedida, stockActual, stockMinimo },
    });
    if (before && before.nombre !== nombre) {
      await tx.inventoryAudit.create({
        data: {
          accion: "RENOMBRE",
          nombre,
          detalle: `Antes: ${before.nombre}`,
          userId: session.user.id,
        },
      });
    }
  });
  revalidatePath("/admin");
  revalidatePath("/inventario");
}

export async function deleteIngredientAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta el ingrediente");
  const ing = await prisma.ingredient.findUnique({
    where: { id },
    include: { prepOutputOf: { include: { _count: { select: { batches: true } } } } },
  });
  if (!ing) throw new Error("Ingrediente no encontrado");
  if (ing.prepOutputOf && ing.prepOutputOf._count.batches > 0) {
    throw new Error(
      `No se puede borrar "${ing.nombre}": hay lotes registrados de su preparación`,
    );
  }
  await prisma.$transaction(async (tx) => {
    if (ing.prepOutputOf) {
      await tx.prepRecipe.delete({ where: { id: ing.prepOutputOf.id } });
    }
    await tx.inventoryAudit.create({
      data: {
        accion: "BAJA",
        nombre: ing.nombre,
        detalle: `Stock al borrar: ${ing.stockActual.toString()} ${ing.unidadMedida}`,
        userId: session.user.id,
      },
    });
    await tx.ingredient.delete({ where: { id } });
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

const prepRecipeSchema = z.object({
  id: z.string().min(1).optional(),
  nombre: z.string().min(1).max(80),
  outputIngredientId: z.string().min(1),
  rendimiento: z.coerce.number().positive(),
  tiempoPreparacion: z.coerce.number().int().min(0).nullable(),
  pasos: z.array(z.string().min(1)),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        cantidad: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export async function savePrepRecipeAction(raw: unknown) {
  await requireAdmin();
  const parsed = prepRecipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  const { id, nombre, outputIngredientId, rendimiento, tiempoPreparacion, pasos, items } =
    parsed.data;

  const uniqueInputs = new Set(items.map((i) => i.ingredientId));
  if (uniqueInputs.size !== items.length) {
    return { ok: false as const, error: "Hay un ingrediente repetido" };
  }
  if (uniqueInputs.has(outputIngredientId)) {
    return { ok: false as const, error: "La salsa no puede usarse como ingrediente de sí misma" };
  }

  const others = await prisma.prepRecipe.findMany({
    where: id ? { id: { not: id } } : undefined,
    include: { ingredients: true },
  });
  if (
    wouldCreateCycle(
      outputIngredientId,
      items.map((i) => i.ingredientId),
      others.map((p) => ({
        outputIngredientId: p.outputIngredientId,
        inputIngredientIds: p.ingredients.map((i) => i.ingredientId),
      })),
    )
  ) {
    return {
      ok: false as const,
      error: "Esa preparación formaría un ciclo (una salsa no puede depender de sí misma)",
    };
  }

  const taken = await prisma.prepRecipe.findUnique({
    where: { outputIngredientId },
  });
  if (taken && taken.id !== id) {
    return { ok: false as const, error: "Ese producto ya tiene una preparación" };
  }

  await prisma.$transaction(async (tx) => {
    const recipe = id
      ? await tx.prepRecipe.update({
          where: { id },
          data: { nombre, outputIngredientId, rendimiento, tiempoPreparacion, pasos },
        })
      : await tx.prepRecipe.create({
          data: { nombre, outputIngredientId, rendimiento, tiempoPreparacion, pasos },
        });
    await tx.prepRecipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    await tx.prepRecipeIngredient.createMany({
      data: items.map((i) => ({
        recipeId: recipe.id,
        ingredientId: i.ingredientId,
        cantidad: i.cantidad,
      })),
    });
  });
  revalidatePath("/cocina");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deletePrepRecipeAction(id: string) {
  await requireAdmin();
  const batches = await prisma.prepBatch.count({ where: { recipeId: id } });
  if (batches > 0) {
    return {
      ok: false as const,
      error: "Hay lotes registrados; no se puede borrar esta preparación",
    };
  }
  await prisma.prepRecipe.delete({ where: { id } });
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
  const session = await requireAdmin();
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
  await prisma.$transaction(async (tx) => {
    await tx.ingredient.create({
      data: {
        id,
        nombre,
        unidadMedida: unidad,
        stockMinimo,
        stockActual: stockMinimo,
      },
    });
    await tx.inventoryAudit.create({
      data: {
        accion: "ALTA",
        nombre,
        detalle: `Creado desde administración · ${unidad}`,
        userId: session.user.id,
      },
    });
  });
  revalidatePath("/admin");
  revalidatePath("/inventario");
}
