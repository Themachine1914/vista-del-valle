/**
 * Deja en la base SOLO las recetas del cuaderno (prisma/catalog.ts).
 * Crea salsas/aceite si faltan. No toca ventas ni stock.
 *
 *   npx tsx scripts/sync-recetas-cuaderno.ts
 */
import { PrismaClient } from "@prisma/client";
import { ingredients, recipes } from "../prisma/catalog";

const prisma = new PrismaClient();

async function main() {
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

  const keep = new Set(recipes.map((r) => r.dishId));
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
    await prisma.recipeIngredient.createMany({
      data: rec.items.map(([ingredientId, cantidad]) => ({
        recipeId,
        ingredientId,
        cantidad,
      })),
    });
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
