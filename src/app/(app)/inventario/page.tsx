import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatFechaCorta, formatStockCompra, toMoney, todayISO } from "@/lib/money";
import { InventarioClient } from "@/components/app/InventarioClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const canAdjust = session?.user.role === "ADMIN";
  const [ingredients, audits, compras] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
    prisma.inventoryAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { tipo: "ENTRADA" },
      orderBy: { fecha: "desc" },
      take: 40,
      include: {
        ingredient: { select: { nombre: true, unidadMedida: true } },
        user: { select: { name: true } },
      },
    }),
  ]);
  const rows = ingredients.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidadMedida: i.unidadMedida,
    stockActual: toMoney(i.stockActual),
    stockMinimo: toMoney(i.stockMinimo),
    bajo: toMoney(i.stockActual) < toMoney(i.stockMinimo),
    etiqueta: formatStockCompra(i.stockActual, i.unidadMedida),
    minimoEtiqueta: formatStockCompra(i.stockMinimo, i.unidadMedida),
  }));
  return (
    <InventarioClient
      rows={rows}
      canAdjust={canAdjust}
      audits={audits.map((a) => ({
        id: a.id,
        accion: a.accion,
        nombre: a.nombre,
        detalle: a.detalle,
        usuario: a.user?.name ?? "Sistema",
        createdAt: formatFechaCorta(a.createdAt),
      }))}
      compras={compras.map((m) => ({
        id: m.id,
        producto: m.ingredient.nombre,
        nota: m.nota,
        etiqueta: formatStockCompra(m.cantidad, m.ingredient.unidadMedida),
        usuario: m.user?.name ?? "Sistema",
        fecha: formatFechaCorta(m.fecha),
      }))}
      defaultFecha={todayISO()}
    />
  );
}
