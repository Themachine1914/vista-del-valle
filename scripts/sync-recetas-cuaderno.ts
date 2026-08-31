/**
 * Deja en la base SOLO las recetas del cuaderno (prisma/catalog.ts).
 * Crea categoría/platos de salsas e ingredientes si faltan. No toca ventas ni stock.
 *
 *   npx tsx scripts/sync-recetas-cuaderno.ts
 */
import { PrismaClient } from "@prisma/client";
import { categories, dishes, ingredients, recipes } from "../prisma/catalog";

const prisma = new PrismaClient();

async function main() {
  const keep = new Set(recipes.map((r) => r.dishId));
  const neededDishIds = [...keep];
  const catalogDishes = dishes.filter((d) => keep.has(d.id));
  const neededCategoryIds = new Set(catalogDishes.map((d) => d.categoryId));

  for (const cat of categories.filter((c) => neededCategoryIds.has(c.id))) {
    await prisma.category.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        nombre: cat.nombre,
        tipo: cat.tipo,
        esInterna: cat.esInterna,
        orden: cat.orden,
      },
      update: {
        nombre: cat.nombre,
        tipo: cat.tipo,
        esInterna: cat.esInterna,
        orden: cat.orden,
      },
    });
  }

  for (const d of catalogDishes) {
    await prisma.dish.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion,
        precio: d.precio ?? null,
        categoryId: d.categoryId,
        destacado: Boolean(d.destacado),
        incluyeGuarnicion: Boolean(d.incluyeGuarnicion),
      },
      update: {
        nombre: d.nombre,
        descripcion: d.descripcion,
        categoryId: d.categoryId,
      },
    });
  }
  if (neededDishIds.length) {
    console.log("Platos de receta al día:", neededDishIds.length);
  }

  const neededIds = new Set(recipes.flatMap((r) => r.items.map(([id]) => id)));
  const existing = await prisma.ingredient.findMany({ select: { id: true } });
  const have = new Set(existing.map((i) => i.id));
  const missing = ingredients.filter((i) => neededIds.has(i.id) && !have.has(i.id));
  if (missing.length) {
    await prisma.ingredient.createMany({
      data: missing.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        unidadMedida: i.unidad,
        stockActual: 0,
        stockMinimo: i.minimo,
      })),
    });
    console.log("Ingredientes creados:", missing.map((i) => i.nombre).join(", "));
  }

  const current = await prisma.recipe.findMany({ select: { id: true, dishId: true } });
  const extra = current.filter((r) => !keep.has(r.dishId));
  if (extra.length) {
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: { in: extra.map((r) => r.id) } },
    });
    await prisma.recipe.deleteMany({ where: { id: { in: extra.map((r) => r.id) } } });
    console.log("Recetas quitadas:", extra.length);
  }

  for (const rec of recipes) {
    const dish = await prisma.dish.findUnique({
      where: { id: rec.dishId },
      include: { recipe: true },
    });
    if (!dish) {
      console.log("Plato no existe, se omite:", rec.dishId);
      continue;
    }
    let recipeId = dish.recipe?.id;
    if (!recipeId) {
      const created = await prisma.recipe.create({
        data: {
          dishId: dish.id,
          porcionesQueRinde: 1,
          tiempoPreparacion: rec.minutos,
          pasos: rec.pasos,
        },
      });
      recipeId = created.id;
    } else {
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { tiempoPreparacion: rec.minutos, pasos: rec.pasos },
      });
    }
    await prisma.recipeIngredient.deleteMany({ where: { recipeId } });
    if (rec.items.length) {
      await prisma.recipeIngredient.createMany({
        data: rec.items.map(([ingredientId, cantidad]) => ({
          recipeId,
          ingredientId,
          cantidad,
        })),
      });
    }
    console.log("OK", dish.nombre);
  }

  const total = await prisma.recipe.count();
  console.log(`Listo. Recetas en la base: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
