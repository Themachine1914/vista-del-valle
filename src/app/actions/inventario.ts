"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adjustStock, slugIngredientId } from "@/lib/inventory";
import {
  customFromIngredient,
  displayToStock,
  etiquetaTipo,
  purchaseToStock,
  resolveEntrada,
  stockToDisplay,
  tipoFromIngredient,
  tipoFromUnidad,
  type TipoEntrada,
} from "@/lib/inventory-units";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function parseDay(fecha: string) {
  return new Date(`${fecha}T12:00:00`);
}

async function convertRecipeQuantities(
  tx: Prisma.TransactionClient,
  ingredientId: string,
  fromUnidad: "G" | "ML" | "UD",
  fromEtiqueta: string,
  tipoNuevo: TipoEntrada,
  customNuevo: string,
) {
  const to = resolveEntrada(tipoNuevo, customNuevo);
  if (fromUnidad === to.unidadMedida) return;
  const lines = await tx.recipeIngredient.findMany({ where: { ingredientId } });
  for (const line of lines) {
    const display = stockToDisplay(Number(line.cantidad), fromUnidad, fromEtiqueta);
    await tx.recipeIngredient.update({
      where: {
        recipeId_ingredientId: { recipeId: line.recipeId, ingredientId },
      },
      data: { cantidad: displayToStock(display, tipoNuevo, customNuevo) },
    });
  }
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

function refresh() {
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

const ajusteSchema = z.object({
  ingredientId: z.string().min(1),
  tipo: z.enum(["ENTRADA", "AJUSTE"]),
  cantidad: z.coerce.number(),
  nota: z.string().max(200).optional(),
});

export async function ajustarInventarioAction(raw: unknown) {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "Solo administración puede ajustar stock" };
  }
  const parsed = ajusteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  try {
    if (parsed.data.cantidad === 0) {
      return { ok: false as const, error: "La cantidad no puede ser 0" };
    }
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: parsed.data.ingredientId },
    });
    if (!ingredient) {
      return { ok: false as const, error: "Producto no encontrado" };
    }
    const conv = purchaseToStock({
      tipoEntrada: tipoFromIngredient(ingredient.unidadMedida, ingredient.unidadEtiqueta),
      unidadCustom: customFromIngredient(ingredient.unidadMedida, ingredient.unidadEtiqueta),
      cantidadItems: 1,
      contenidoPorItem: Math.abs(parsed.data.cantidad),
    });
    const signed =
      parsed.data.tipo === "ENTRADA"
        ? conv.cantidadStock
        : Math.sign(parsed.data.cantidad) * conv.cantidadStock;
    await adjustStock({
      ingredientId: parsed.data.ingredientId,
      tipo: parsed.data.tipo,
      cantidad: signed,
      nota: parsed.data.nota,
      userId: session.user.id,
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ajustar";
    return { ok: false as const, error: message };
  }
}

const compraSchema = z.object({
  ingredientId: z.string().optional(),
  nombreNuevo: z.string().max(80).optional(),
  tipoEntrada: z.enum(["LIBRA", "KILO", "LITRO", "UNIDAD", "OTRO"]),
  unidadCustom: z.string().max(24).optional(),
  cantidadItems: z.coerce.number().positive(),
  contenidoPorItem: z.coerce.number().positive(),
  stockMinimo: z.coerce.number().min(0),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  precioTotal: z.coerce.number().positive(),
  nota: z.string().max(200).optional(),
});

export async function registrarCompraAction(raw: unknown) {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "Solo administración puede registrar compras" };
  }
  const parsed = compraSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  const data = parsed.data;
  const nombreNuevo = data.nombreNuevo?.trim() ?? "";
  if (!data.ingredientId && !nombreNuevo) {
    return { ok: false as const, error: "Elige un producto o escribe uno nuevo" };
  }

  try {
    const conv = purchaseToStock({
      tipoEntrada: data.tipoEntrada as TipoEntrada,
      unidadCustom: data.unidadCustom,
      cantidadItems: data.cantidadItems,
      contenidoPorItem: data.contenidoPorItem,
    });
    const fecha = parseDay(data.fecha);
    const etiquetaUnidad = conv.etiqueta;
    const minimoInterno = displayToStock(
      data.stockMinimo,
      data.tipoEntrada,
      data.unidadCustom,
    );
    const notaCompra =
      data.nota?.trim() ||
      `Compra ${data.fecha}: ${data.cantidadItems} × ${data.contenidoPorItem} ${etiquetaUnidad}`;

    const result = await prisma.$transaction(async (tx) => {
      let ingredient = data.ingredientId
        ? await tx.ingredient.findUnique({ where: { id: data.ingredientId } })
        : null;

      let created = false;
      if (!ingredient) {
        const existingName = await tx.ingredient.findUnique({
          where: { nombre: nombreNuevo },
        });
        if (existingName) {
          throw new Error("Ya existe un producto con ese nombre");
        }
        ingredient = await tx.ingredient.create({
          data: {
            id: slugIngredientId(nombreNuevo),
            nombre: nombreNuevo,
            unidadMedida: conv.unidadMedida,
            unidadEtiqueta: etiquetaUnidad,
            stockActual: 0,
            stockMinimo: minimoInterno,
          },
        });
        created = true;
        await tx.inventoryAudit.create({
          data: {
            accion: "ALTA",
            nombre: ingredient.nombre,
            detalle: `Producto nuevo · ${etiquetaUnidad} · mín. ${data.stockMinimo} ${etiquetaUnidad}`,
            userId: session.user.id,
          },
        });
      } else {
        const unidadAnterior = ingredient.unidadMedida;
        const etiquetaAnterior = ingredient.unidadEtiqueta;
        const etiquetaVieja =
          etiquetaAnterior || etiquetaTipo(tipoFromUnidad(unidadAnterior));
        if (unidadAnterior !== conv.unidadMedida) {
          const stockConvertido = displayToStock(
            stockToDisplay(
              Number(ingredient.stockActual),
              unidadAnterior,
              etiquetaAnterior,
            ),
            data.tipoEntrada,
            data.unidadCustom,
          );
          await convertRecipeQuantities(
            tx,
            ingredient.id,
            unidadAnterior,
            etiquetaAnterior,
            data.tipoEntrada,
            data.unidadCustom ?? "",
          );
          await tx.inventoryAudit.create({
            data: {
              accion: "RENOMBRE",
              nombre: ingredient.nombre,
              detalle: `Volumen: ${etiquetaVieja} → ${etiquetaUnidad}`,
              userId: session.user.id,
            },
          });
          await tx.ingredient.update({
            where: { id: ingredient.id },
            data: {
              unidadMedida: conv.unidadMedida,
              unidadEtiqueta: etiquetaUnidad,
              stockActual: stockConvertido,
              stockMinimo: minimoInterno,
            },
          });
        } else {
          if (etiquetaAnterior !== etiquetaUnidad) {
            await tx.inventoryAudit.create({
              data: {
                accion: "RENOMBRE",
                nombre: ingredient.nombre,
                detalle: `Volumen: ${etiquetaVieja} → ${etiquetaUnidad}`,
                userId: session.user.id,
              },
            });
          }
          await tx.ingredient.update({
            where: { id: ingredient.id },
            data: {
              unidadEtiqueta: etiquetaUnidad,
              stockMinimo: minimoInterno,
            },
          });
        }
      }

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: { stockActual: { increment: conv.cantidadStock } },
      });
      await tx.inventoryMovement.create({
        data: {
          ingredientId: ingredient.id,
          tipo: "ENTRADA",
          cantidad: conv.cantidadStock,
          precioTotal: data.precioTotal,
          nota: notaCompra,
          fecha,
          userId: session.user.id,
        },
      });
      return { nombre: ingredient.nombre, created };
    });

    refresh();
    return {
      ok: true as const,
      created: result.created,
      nombre: result.nombre,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar";
    return { ok: false as const, error: message };
  }
}

const renameSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1).max(80),
  tipoEntrada: z.enum(["LIBRA", "KILO", "LITRO", "UNIDAD", "OTRO"]),
  unidadCustom: z.string().max(24).optional(),
  stockMinimo: z.coerce.number().min(0),
});

export async function guardarProductoAction(raw: unknown) {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "No autorizado" };
  }
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  const nombre = parsed.data.nombre.trim();
  const tipoNuevo = parsed.data.tipoEntrada as TipoEntrada;
  try {
    const resuelta = resolveEntrada(tipoNuevo, parsed.data.unidadCustom);
    const before = await prisma.ingredient.findUnique({
      where: { id: parsed.data.id },
    });
    if (!before) return { ok: false as const, error: "Producto no encontrado" };
    const minimoInterno = displayToStock(
      parsed.data.stockMinimo,
      tipoNuevo,
      parsed.data.unidadCustom,
    );
    const unidadCambia = before.unidadMedida !== resuelta.unidadMedida;
    const etiquetaCambia = before.unidadEtiqueta !== resuelta.etiqueta;
    const nombreCambia = before.nombre !== nombre;
    const minimoCambia = Number(before.stockMinimo) !== minimoInterno;
    if (!unidadCambia && !etiquetaCambia && !nombreCambia && !minimoCambia) {
      return { ok: true as const };
    }
    await prisma.$transaction(async (tx) => {
      let stockActual = Number(before.stockActual);
      if (unidadCambia) {
        stockActual = displayToStock(
          stockToDisplay(stockActual, before.unidadMedida, before.unidadEtiqueta),
          tipoNuevo,
          parsed.data.unidadCustom,
        );
        await convertRecipeQuantities(
          tx,
          before.id,
          before.unidadMedida,
          before.unidadEtiqueta,
          tipoNuevo,
          parsed.data.unidadCustom ?? "",
        );
      }
      await tx.ingredient.update({
        where: { id: parsed.data.id },
        data: {
          nombre,
          unidadMedida: resuelta.unidadMedida,
          unidadEtiqueta: resuelta.etiqueta,
          stockMinimo: minimoInterno,
          stockActual,
        },
      });
      const detalles: string[] = [];
      if (nombreCambia) detalles.push(`Antes: ${before.nombre}`);
      if (unidadCambia || etiquetaCambia) {
        const etiquetaVieja =
          before.unidadEtiqueta || etiquetaTipo(tipoFromUnidad(before.unidadMedida));
        detalles.push(`Volumen: ${etiquetaVieja} → ${resuelta.etiqueta}`);
      }
      if (minimoCambia) {
        detalles.push(`Mínimo: ${parsed.data.stockMinimo} ${resuelta.etiqueta}`);
      }
      await tx.inventoryAudit.create({
        data: {
          accion: "RENOMBRE",
          nombre,
          detalle: detalles.join(" · "),
          userId: session.user.id,
        },
      });
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique")
        ? "Ya existe un producto con ese nombre"
        : error instanceof Error
          ? error.message
          : "No se pudo guardar";
    return { ok: false as const, error: message };
  }
}

export async function borrarProductoAction(raw: unknown) {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "No autorizado" };
  }
  const id = typeof raw === "object" && raw && "id" in raw ? String(raw.id) : "";
  if (!id) return { ok: false as const, error: "Falta el producto" };
  try {
    const ing = await prisma.ingredient.findUnique({ where: { id } });
    if (!ing) return { ok: false as const, error: "Producto no encontrado" };
    await prisma.$transaction(async (tx) => {
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
    refresh();
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo borrar";
    return { ok: false as const, error: message };
  }
}

