import { PrismaClient, type Turno } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  categories,
  dishes,
  historicalUnits,
  ingredients,
  prepRecipes,
  recipes,
} from "./catalog";

const prisma = new PrismaClient();

function photoFor(dishId: string, categoryId: string): string {
  const mapPath = join(__dirname, "photo-map.json");
  if (existsSync(mapPath)) {
    const map = JSON.parse(readFileSync(mapPath, "utf8")) as Record<string, string>;
    if (map[dishId]) return map[dishId];
  }
  const local = `/images/platos/${dishId}.jpg`;
  const localPath = join(__dirname, "..", "public", "images", "platos", `${dishId}.jpg`);
  if (existsSync(localPath)) return local;
  return `/images/placeholders/${categoryId}.svg`;
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function distribute(total: number, days: Date[]): number[] {
  const weights = days.map((d) => {
    const dow = d.getUTCDay();
    return dow === 0 || dow === 6 ? 1.7 : 1;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((n) => Math.floor(n));
  let remain = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remain <= 0) break;
    floors[i] += 1;
    remain -= 1;
  }
  return floors;
}

function turnoFor(dishId: string, dayIndex: number): Turno {
  const breakfast = new Set([
    "desayuno-dominicano",
    "desayuno-americano",
    "omelette",
    "tostada-rustica",
    "el-ligero",
    "sandwich-jamon-queso",
    "derretido-queso",
    "croissant",
    "huevos-estrellados",
    "croissant-jamon",
    "cafe-negro",
    "cafe-leche",
    "cafe-crema",
  ]);
  if (breakfast.has(dishId) && dayIndex % 5 !== 0) return "DESAYUNO";
  const bag = ["ALMUERZO", "ALMUERZO", "ALMUERZO", "CENA", "CENA"] as Turno[];
  return bag[dayIndex % bag.length];
}

const GARNISHES = ["tostones", "habichuelas", "arroz-blanco", "aguacate", "moro-guandules"];

async function main() {
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.prepBatch.deleteMany();
  await prisma.prepRecipeIngredient.deleteMany();
  await prisma.prepRecipe.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash("ValleAdmin2026", 10);
  const cocinaHash = await bcrypt.hash("ValleCocina2026", 10);
  const camareroHash = await bcrypt.hash("ValleCamarero2026", 10);

  await prisma.user.createMany({
    data: [
      {
        id: "user-admin",
        name: "Administradora",
        email: "admin@vistadelvalle.local",
        passwordHash: adminHash,
        role: "ADMIN",
      },
      {
        id: "user-camarero",
        name: "Camarero",
        email: "camarero@vistadelvalle.local",
        passwordHash: camareroHash,
        role: "CAMARERO",
      },
      {
        id: "user-cocina",
        name: "Cocina",
        email: "cocina@vistadelvalle.local",
        passwordHash: cocinaHash,
        role: "COCINA",
      },
    ],
  });

  await prisma.category.createMany({ data: categories });

  await prisma.dish.createMany({
    data: dishes.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      descripcion: d.descripcion,
      precio: d.precio ?? null,
      foto: photoFor(d.id, d.categoryId),
      categoryId: d.categoryId,
      destacado: Boolean(d.destacado),
      incluyeGuarnicion: Boolean(d.incluyeGuarnicion),
    })),
  });

  await prisma.ingredient.createMany({
    data: ingredients.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      unidadMedida: i.unidad,
      stockActual: i.minimo,
      stockMinimo: i.minimo,
    })),
  });

  const ingredientIds = new Set(ingredients.map((i) => i.id));
  const dishIds = new Set(dishes.map((d) => d.id));

  for (const recipe of recipes) {
    if (!dishIds.has(recipe.dishId)) {
      throw new Error(`Receta huérfana: ${recipe.dishId}`);
    }
    const created = await prisma.recipe.create({
      data: {
        dishId: recipe.dishId,
        porcionesQueRinde: 1,
        tiempoPreparacion: recipe.minutos,
        pasos: recipe.pasos,
      },
    });
    const lines = recipe.items.filter(([id]) => ingredientIds.has(id));
    if (lines.length !== recipe.items.length) {
      const missing = recipe.items.filter(([id]) => !ingredientIds.has(id));
      throw new Error(`Ingrediente faltante en ${recipe.dishId}: ${missing.map((m) => m[0]).join(", ")}`);
    }
    await prisma.recipeIngredient.createMany({
      data: lines.map(([ingredientId, cantidad]) => ({
        recipeId: created.id,
        ingredientId,
        cantidad,
      })),
    });
  }

  for (const prep of prepRecipes) {
    if (!ingredientIds.has(prep.outputIngredientId)) {
      throw new Error(`Preparación sin producto: ${prep.outputIngredientId}`);
    }
    const missing = prep.items.filter(([id]) => !ingredientIds.has(id));
    if (missing.length) {
      throw new Error(
        `Ingrediente faltante en ${prep.id}: ${missing.map((m) => m[0]).join(", ")}`,
      );
    }
    if (prep.items.some(([id]) => id === prep.outputIngredientId)) {
      throw new Error(`La preparación ${prep.id} se consume a sí misma`);
    }
    await prisma.prepRecipe.create({
      data: {
        id: prep.id,
        nombre: prep.nombre,
        outputIngredientId: prep.outputIngredientId,
        rendimiento: prep.rendimiento,
        tiempoPreparacion: prep.minutos,
        pasos: prep.pasos,
        ingredients: {
          create: prep.items.map(([ingredientId, cantidad]) => ({
            ingredientId,
            cantidad,
          })),
        },
      },
    });
  }

  const days = eachDay(
    new Date(Date.UTC(2026, 5, 1)),
    new Date(Date.UTC(2026, 6, 31)),
  );

  const saleKeys = new Map<string, { fecha: Date; turno: Turno }>();
  const items: {
    key: string;
    dishId: string;
    cantidad: number;
    precio: number;
    garnishId: string | null;
  }[] = [];

  const dishById = new Map(dishes.map((d) => [d.id, d]));

  for (const [dishId, units] of Object.entries(historicalUnits)) {
    if (!dishIds.has(dishId)) {
      throw new Error(`Histórico apunta a plato inexistente: ${dishId}`);
    }
    const perDay = distribute(units, days);
    perDay.forEach((qty, idx) => {
      if (qty < 1) return;
      const fecha = days[idx];
      const turno = turnoFor(dishId, idx);
      const key = `${fecha.toISOString().slice(0, 10)}|${turno}`;
      saleKeys.set(key, { fecha, turno });
      const dish = dishById.get(dishId)!;
      const garnishId = dish.incluyeGuarnicion
        ? GARNISHES[idx % GARNISHES.length]
        : null;
      items.push({
        key,
        dishId,
        cantidad: qty,
        precio: dish.precio ?? 0,
        garnishId,
      });
    });
  }

  const saleIdByKey = new Map<string, string>();
  for (const [key, value] of saleKeys) {
    const sale = await prisma.sale.create({
      data: { fecha: value.fecha, turno: value.turno },
    });
    saleIdByKey.set(key, sale.id);
  }

  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    await prisma.saleItem.createMany({
      data: chunk.map((it) => ({
        saleId: saleIdByKey.get(it.key)!,
        dishId: it.dishId,
        cantidad: it.cantidad,
        precioUnitario: it.precio,
        garnishId: it.garnishId,
      })),
    });
  }

  console.log(
    `Seed OK: ${dishes.length} platos, ${ingredients.length} ingredientes, ${recipes.length} recetas, ${prepRecipes.length} preparaciones, ${saleKeys.size} ventas, ${items.length} líneas.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
