import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;

export type PrepGraphNode = {
  outputIngredientId: string;
  inputIngredientIds: string[];
};

/** True if this preparación would consume its own output, directly or through other preps. */
export function wouldCreateCycle(
  outputIngredientId: string,
  inputIngredientIds: string[],
  existing: PrepGraphNode[],
): boolean {
  if (inputIngredientIds.includes(outputIngredientId)) return true;

  const adj = new Map<string, string[]>();
  for (const node of existing) {
    if (node.outputIngredientId === outputIngredientId) continue;
    adj.set(node.outputIngredientId, node.inputIngredientIds);
  }
  adj.set(outputIngredientId, inputIngredientIds);

  const seen = new Set<string>();
  const stack = [...inputIngredientIds];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === outputIngredientId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const next = adj.get(cur);
    if (next) stack.push(...next);
  }
  return false;
}

export function computePrepQty(
  recipeQty: Prisma.Decimal.Value,
  lotes: number,
): Prisma.Decimal {
  if (!(lotes > 0)) {
    throw new Error("Los lotes deben ser mayor que 0");
  }
  return new Prisma.Decimal(recipeQty).mul(lotes);
}

export function etiquetaLotes(lotes: number): string {
  const n = Number(lotes);
  const texto = Number.isInteger(n) ? String(n) : String(n);
  return `${texto} lote${n === 1 ? "" : "s"}`;
}

export async function registerPrepBatch(input: {
  recipeId: string;
  lotes: number;
  userId: string;
  fecha?: Date;
}) {
  if (!(input.lotes > 0)) {
    throw new Error("Los lotes deben ser mayor que 0");
  }

  return prisma.$transaction(async (tx) => {
    const recipe = await tx.prepRecipe.findUnique({
      where: { id: input.recipeId },
      include: { ingredients: true },
    });
    if (!recipe) throw new Error("Preparación no encontrada");
    if (recipe.ingredients.length === 0) {
      throw new Error("Esta preparación no tiene ingredientes cargados");
    }

    const fecha = input.fecha ?? new Date();
    const batch = await tx.prepBatch.create({
      data: {
        recipeId: recipe.id,
        lotes: input.lotes,
        fecha,
        userId: input.userId,
      },
    });
    const nota = `Preparación: ${recipe.nombre} (${etiquetaLotes(input.lotes)})`;

    for (const line of recipe.ingredients) {
      const qty = computePrepQty(line.cantidad, input.lotes);
      await applyPrepMovement(tx, {
        ingredientId: line.ingredientId,
        cantidad: qty.negated(),
        nota,
        userId: input.userId,
        fecha,
        prepBatchId: batch.id,
      });
    }

    const produced = computePrepQty(recipe.rendimiento, input.lotes);
    await applyPrepMovement(tx, {
      ingredientId: recipe.outputIngredientId,
      cantidad: produced,
      nota,
      userId: input.userId,
      fecha,
      prepBatchId: batch.id,
    });

    return { batchId: batch.id, nombre: recipe.nombre };
  });
}

export async function voidPrepBatch(input: { batchId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.prepBatch.findUnique({
      where: { id: input.batchId },
      include: {
        recipe: { select: { nombre: true } },
        movements: true,
      },
    });
    if (!batch) throw new Error("Ese lote ya no está");
    if (batch.anulado) throw new Error("Ese lote ya fue anulado");

    const originals = batch.movements.filter(
      (m) => !m.nota?.startsWith("Anulación"),
    );
    const fecha = batch.fecha;
    const nota = `Anulación: ${batch.recipe.nombre} (${etiquetaLotes(Number(batch.lotes))})`;

    for (const m of originals) {
      const reverse = new Prisma.Decimal(m.cantidad).negated();
      await applyPrepMovement(tx, {
        ingredientId: m.ingredientId,
        cantidad: reverse,
        nota,
        userId: input.userId,
        fecha,
        prepBatchId: batch.id,
      });
    }

    await tx.prepBatch.update({
      where: { id: batch.id },
      data: { anulado: true },
    });

    return { nombre: batch.recipe.nombre, lotes: Number(batch.lotes) };
  });
}

async function applyPrepMovement(
  tx: Tx,
  input: {
    ingredientId: string;
    cantidad: Prisma.Decimal;
    nota: string;
    userId: string;
    fecha: Date;
    prepBatchId: string;
  },
) {
  await tx.ingredient.update({
    where: { id: input.ingredientId },
    data: { stockActual: { increment: input.cantidad } },
  });
  await tx.inventoryMovement.create({
    data: {
      ingredientId: input.ingredientId,
      tipo: "PREPARACION",
      cantidad: input.cantidad,
      nota: input.nota,
      userId: input.userId,
      fecha: input.fecha,
      prepBatchId: input.prepBatchId,
    },
  });
}
