"use server";

import { auth } from "@/auth";
import { adjustStock } from "@/lib/inventory";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  ingredientId: z.string().min(1),
  tipo: z.enum(["ENTRADA", "AJUSTE"]),
  cantidad: z.coerce.number(),
  nota: z.string().max(200).optional(),
});

export async function ajustarInventarioAction(raw: unknown) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "Solo administración puede ajustar stock" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  try {
    await adjustStock({
      ...parsed.data,
      userId: session.user.id,
    });
    revalidatePath("/inventario");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ajustar";
    return { ok: false as const, error: message };
  }
}
