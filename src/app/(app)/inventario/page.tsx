import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatQty, toMoney } from "@/lib/money";
import { InventarioClient } from "@/components/app/InventarioClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const canAdjust = session?.user.role === "ADMIN";
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { nombre: "asc" },
  });
  const rows = ingredients.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidadMedida: i.unidadMedida,
    stockActual: toMoney(i.stockActual),
    stockMinimo: toMoney(i.stockMinimo),
    bajo: toMoney(i.stockActual) < toMoney(i.stockMinimo),
    etiqueta: formatQty(i.stockActual, i.unidadMedida),
  }));
  return <InventarioClient rows={rows} canAdjust={canAdjust} />;
}
