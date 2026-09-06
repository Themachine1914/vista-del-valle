"use server";

import { auth } from "@/auth";
import { registerPrepBatch, voidPrepBatch } from "@/lib/prep-recipe";
import { canManagePrep } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireKitchen() {
  const session = await auth();
  if (!session?.user || !canManagePrep(session.user.role)) {
    return null;
  }
  return session;
}

function refresh() {
  revalidatePath("/cocina");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
}

const registrarSchema = z.object({
  recipeId: z.string().min(1),
  lotes: z.coerce.number().positive().max(50),
});

export async function registrarLoteAction(raw: unknown) {
  const session = await requireKitchen();
  if (!session) return { ok: false as const, error: "No autorizado" };
  const parsed = registrarSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  try {
    const result = await registerPrepBatch({
      recipeId: parsed.data.recipeId,
      lotes: parsed.data.lotes,
      userId: session.user.id,
    });
    refresh();
    return { ok: true as const, nombre: result.nombre };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar el lote";
    return { ok: false as const, error: message };
  }
}

export async function anularLoteAction(batchId: string) {
  const session = await requireKitchen();
  if (!session) return { ok: false as const, error: "No autorizado" };
  if (!batchId) return { ok: false as const, error: "Falta el lote" };
  try {
    const result = await voidPrepBatch({
      batchId,
      userId: session.user.id,
    });
    refresh();
    return { ok: true as const, nombre: result.nombre };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo anular el lote";
    return { ok: false as const, error: message };
  }
}
