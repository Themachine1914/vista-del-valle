import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventarioRegistroPdf,
  registroPdfFilename,
} from "@/lib/inventory-registro-pdf";
import { formatFechaCorta, formatStockCompra } from "@/lib/money";
import { parsePeriodo } from "@/lib/period";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "CAMARERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const periodo = parsePeriodo(sp);
  const range = { gte: periodo.gte, lt: periodo.lt };

  const [audits, compras, stock] = await Promise.all([
    prisma.inventoryAudit.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { tipo: "ENTRADA", fecha: range },
      orderBy: { fecha: "desc" },
      include: {
        ingredient: { select: { nombre: true, unidadMedida: true, unidadEtiqueta: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const bytes = buildInventarioRegistroPdf({
    generadoPor: session.user.name ?? session.user.email ?? "Staff",
    periodoLabel: periodo.label,
    audits: audits.map((a) => ({
      createdAt: formatFechaCorta(a.createdAt),
      accion: a.accion,
      nombre: a.nombre,
      detalle: a.detalle ?? "",
      usuario: a.user?.name ?? "Sistema",
    })),
    compras: compras.map((m) => ({
      fecha: formatFechaCorta(m.fecha),
      producto: m.ingredient.nombre,
      etiqueta: formatStockCompra(m.cantidad, m.ingredient.unidadMedida, m.ingredient.unidadEtiqueta),
      nota: m.nota ?? "",
      usuario: m.user?.name ?? "Sistema",
    })),
    stock: stock.map((i) => ({
      nombre: i.nombre,
      stock: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
      minimo: formatStockCompra(i.stockMinimo, i.unidadMedida, i.unidadEtiqueta),
    })),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${registroPdfFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
