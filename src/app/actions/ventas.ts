"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registerSaleItems } from "@/lib/inventory";
import { canRegisterSales } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  dishId: z.string().min(1),
  cantidad: z.coerce.number().int().min(1).max(99),
  garnishId: z.string().nullable().optional(),
  precioUnitario: z.coerce.number().min(0).nullable().optional(),
});

const payloadSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: z.enum(["DESAYUNO", "ALMUERZO", "CENA"]),
  items: z.array(itemSchema).min(1),
});

export async function registrarVentaAction(raw: unknown) {
  const session = await auth();
  if (!session?.user || !canRegisterSales(session.user.role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  try {
    const [y, m, d] = parsed.data.fecha.split("-").map(Number);
    await registerSaleItems({
      fecha: new Date(Date.UTC(y, m - 1, d)),
      turno: parsed.data.turno,
      items: parsed.data.items,
      userId: session.user.id,
    });
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar";
    return { ok: false as const, error: message };
  }
}

export async function getSaleForDay(fecha: string, turno: "DESAYUNO" | "ALMUERZO" | "CENA") {
  const [y, m, d] = fecha.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  return prisma.sale.findUnique({
    where: { fecha_turno: { fecha: day, turno } },
    include: {
      items: {
        include: { dish: true, garnish: true },
        orderBy: { id: "asc" },
      },
    },
  });
}
