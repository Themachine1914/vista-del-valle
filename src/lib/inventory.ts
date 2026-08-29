import { Prisma, type MovementType } from "@prisma/client";
import { prisma } from "./prisma";

export {
  purchaseToStock,
  tipoFromUnidad,
  unidadFromTipo,
  type TipoEntrada,
} from "./inventory-units";

type Tx = Prisma.TransactionClient;

// Core stock-deduction rule: scale each recipe ingredient by how many
// serving-units (unidadesVendidas) were sold relative to how many servings
// the recipe yields (porcionesQueRinde).
export function computeDeductionQty(
  recipeQty: Prisma.Decimal.Value,
  porcionesQueRinde: number,
  unidadesVendidas: number,
): Prisma.Decimal {
  if (porcionesQueRinde <= 0) {
    throw new Error("porcionesQueRinde debe ser mayor que 0");
  }
  const factor = unidadesVendidas / porcionesQueRinde;
  return new Prisma.Decimal(recipeQty).mul(factor);
}

async function deductRecipe(
  tx: Tx,
  dishId: string,
  units: number,
  userId: string,
  nota: string,
  fecha: Date,
) {
  const recipe = await tx.recipe.findUnique({
    where: { dishId },
    include: { ingredients: true },
  });
  if (!recipe) return;

  for (const line of recipe.ingredients) {
    const qty = computeDeductionQty(
      line.cantidad,
      recipe.porcionesQueRinde,
      units,
    );
    await tx.ingredient.update({
      where: { id: line.ingredientId },
      data: { stockActual: { decrement: qty } },
    });
    await tx.inventoryMovement.create({
      data: {
        ingredientId: line.ingredientId,
        tipo: "VENTA",
        cantidad: qty.negated(),
        nota,
        userId,
        fecha,
      },
    });
  }
}

export async function registerSaleItems(input: {
  fecha: Date;
  turno: "DESAYUNO" | "ALMUERZO" | "CENA";
  items: {
    dishId: string;
    cantidad: number;
    garnishId?: string | null;
    precioUnitario?: number | null;
  }[];
  userId: string;
}) {
  if (input.items.length === 0) {
    throw new Error("Agrega al menos un artículo");
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.upsert({
      where: {
        fecha_turno: { fecha: input.fecha, turno: input.turno },
      },
      create: { fecha: input.fecha, turno: input.turno },
      update: {},
    });

    for (const item of input.items) {
      if (item.cantidad < 1) {
        throw new Error("La cantidad debe ser al menos 1");
      }
      const dish = await tx.dish.findUniqueOrThrow({
        where: { id: item.dishId },
      });
      if (dish.incluyeGuarnicion && !item.garnishId) {
        throw new Error(`${dish.nombre} incluye guarnición: elige una`);
      }
      const precio =
        item.precioUnitario ?? (dish.precio ? Number(dish.precio) : 0);

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          dishId: item.dishId,
          cantidad: item.cantidad,
          precioUnitario: precio,
          garnishId: item.garnishId ?? null,
          userId: input.userId,
        },
      });

      await deductRecipe(
        tx,
        item.dishId,
        item.cantidad,
        input.userId,
        `Venta: ${dish.nombre}`,
        input.fecha,
      );
      if (item.garnishId) {
        const garnish = await tx.dish.findUniqueOrThrow({
          where: { id: item.garnishId },
        });
        await deductRecipe(
          tx,
          item.garnishId,
          item.cantidad,
          input.userId,
          `Guarnición: ${garnish.nombre}`,
          input.fecha,
        );
      }
    }

    return sale;
  });
}

export async function adjustStock(input: {
  ingredientId: string;
  tipo: Exclude<MovementType, "VENTA">;
  cantidad: number;
  nota?: string;
  userId: string;
  fecha?: Date;
}) {
  if (input.cantidad === 0) {
    throw new Error("La cantidad no puede ser 0");
  }
  const signed =
    input.tipo === "ENTRADA"
      ? Math.abs(input.cantidad)
      : input.cantidad;

  return prisma.$transaction(async (tx) => {
    await tx.ingredient.update({
      where: { id: input.ingredientId },
      data: { stockActual: { increment: signed } },
    });
    return tx.inventoryMovement.create({
      data: {
        ingredientId: input.ingredientId,
        tipo: input.tipo,
        cantidad: signed,
        nota: input.nota,
        userId: input.userId,
        fecha: input.fecha ?? new Date(),
      },
    });
  });
}

export function slugIngredientId(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `${base || "producto"}-${Date.now().toString(36)}`;
}
