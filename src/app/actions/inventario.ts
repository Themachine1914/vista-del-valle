"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adjustStock, slugIngredientId } from "@/lib/inventory";
import {
  etiquetaTipo,
  purchaseToStock,
  tipoFromUnidad,
  type TipoEntrada,
} from "@/lib/inventory-units";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function parseDay(fecha: string) {
  return new Date(`${fecha}T12:00:00`);
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
      tipoEntrada: tipoFromUnidad(ingredient.unidadMedida),
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
  tipoEntrada: z.enum(["LIBRA", "LITRO", "UNIDAD"]),
  cantidadItems: z.coerce.number().positive(),
  contenidoPorItem: z.coerce.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      cantidadItems: data.cantidadItems,
      contenidoPorItem: data.contenidoPorItem,
    });
    const fecha = parseDay(data.fecha);
    const etiquetaUnidad = etiquetaTipo(data.tipoEntrada as TipoEntrada);
    const notaCompra =
      data.nota?.trim() ||
      `Compra ${data.fecha}: ${data.cantidadItems} × ${data.contenidoPorItem} ${etiquetaUnidad}`;

    const result = await prisma.$transaction(async (tx) => {
      let ingredient = data.ingredientId
        ? await tx.ingredient.findUnique({ where: { id: data.ingredientId } })
        : null;

      if (ingredient && ingredient.unidadMedida !== conv.unidadMedida) {
        throw new Error(
          `Este producto se registra en ${
            ingredient.unidadMedida === "G"
              ? "libras"
              : ingredient.unidadMedida === "ML"
                ? "litros"
                : "unidades"
          }`,
        );
      }

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
            stockActual: 0,
            stockMinimo: 0,
          },
        });
        created = true;
        await tx.inventoryAudit.create({
          data: {
            accion: "ALTA",
            nombre: ingredient.nombre,
            detalle: `Producto nuevo · ${etiquetaUnidad}`,
            userId: session.user.id,
          },
        });
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
});

export async function renombrarProductoAction(raw: unknown) {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "No autorizado" };
  }
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Nombre inválido" };
  }
  const nombre = parsed.data.nombre.trim();
  try {
    const before = await prisma.ingredient.findUnique({
      where: { id: parsed.data.id },
    });
    if (!before) return { ok: false as const, error: "Producto no encontrado" };
    if (before.nombre === nombre) return { ok: true as const };
    await prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: parsed.data.id },
        data: { nombre },
      });
      await tx.inventoryAudit.create({
        data: {
          accion: "RENOMBRE",
          nombre,
          detalle: `Antes: ${before.nombre}`,
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
          : "No se pudo renombrar";
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

export async function resetearInventarioAction() {
  const session = await requireAdmin();
  if (!session) {
    return { ok: false as const, error: "No autorizado" };
  }
  const count = await prisma.ingredient.count();
  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.deleteMany();
    await tx.ingredient.updateMany({ data: { stockActual: 0 } });
    await tx.inventoryAudit.create({
      data: {
        accion: "RESET",
        nombre: "Inventario",
        detalle: `Stock de ${count} productos puesto en 0. Historial de movimientos reiniciado.`,
        userId: session.user.id,
      },
    });
  });
  refresh();
  return { ok: true as const, count };
}

