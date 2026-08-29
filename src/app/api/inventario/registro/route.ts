import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventarioRegistroPdf,
  registroPdfFilename,
} from "@/lib/inventory-registro-pdf";
import { sumarConsumo } from "@/lib/inventory-consumo";
import {
  etiquetaPrecioCompra,
  ultimasComprasPorProducto,
  valorAlPrecio,
  type MovimientoPrecio,
} from "@/lib/inventory-precio";
import { formatFechaCorta, formatRD, formatRDUnitario, formatStockCompra, toMoney } from "@/lib/money";
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

  const [audits, compras, stock, ventas, entradas] = await Promise.all([
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
    prisma.inventoryMovement.findMany({
      where: { tipo: "VENTA", fecha: range },
      include: {
        ingredient: { select: { unidadMedida: true, unidadEtiqueta: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: { tipo: "ENTRADA" },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      include: {
        ingredient: { select: { unidadMedida: true, unidadEtiqueta: true } },
      },
    }),
  ]);
  const historial: MovimientoPrecio[] = entradas.map((m) => ({
    id: m.id,
    ingredientId: m.ingredientId,
    cantidad: toMoney(m.cantidad),
    precioTotal: m.precioTotal == null ? null : toMoney(m.precioTotal),
    fecha: m.fecha,
    createdAt: m.createdAt,
    unidadMedida: m.ingredient.unidadMedida,
    unidadEtiqueta: m.ingredient.unidadEtiqueta,
  }));
  const ultimas = ultimasComprasPorProducto(historial);
  const consumoPorId = sumarConsumo(
    ventas.map((m) => ({
      ingredientId: m.ingredientId,
      cantidad: toMoney(m.cantidad),
    })),
  );

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
    compras: compras.map((m) => {
      const precio = etiquetaPrecioCompra(
        m.precioTotal == null ? null : toMoney(m.precioTotal),
        toMoney(m.cantidad),
        m.ingredient.unidadMedida,
        m.ingredient.unidadEtiqueta,
      );
      return {
        fecha: formatFechaCorta(m.fecha),
        producto: m.ingredient.nombre,
        etiqueta: formatStockCompra(
          m.cantidad,
          m.ingredient.unidadMedida,
          m.ingredient.unidadEtiqueta,
        ),
        precio: precio.total,
        unitario: precio.unitario,
        nota: m.nota ?? "",
        usuario: m.user?.name ?? "Sistema",
      };
    }),
    stock: stock.map((i) => {
      const consumo = consumoPorId[i.id] ?? 0;
      const ultima = ultimas[i.id];
      const valor = ultima
        ? valorAlPrecio(
            toMoney(i.stockActual),
            ultima.unitario,
            i.unidadMedida,
            i.unidadEtiqueta,
          )
        : null;
      return {
        nombre: i.nombre,
        stock: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
        minimo: formatStockCompra(i.stockMinimo, i.unidadMedida, i.unidadEtiqueta),
        consumo:
          consumo > 0
            ? formatStockCompra(consumo, i.unidadMedida, i.unidadEtiqueta)
            : "—",
        precio: ultima
          ? `${formatRDUnitario(ultima.unitario)} / ${ultima.etiquetaUnidad}`
          : "—",
        valor: valor == null ? "—" : formatRD(valor),
      };
    }),
    consumo: stock
      .filter((i) => (consumoPorId[i.id] ?? 0) > 0)
      .sort((a, b) => (consumoPorId[b.id] ?? 0) - (consumoPorId[a.id] ?? 0))
      .map((i) => {
        const ultima = ultimas[i.id];
        const costo = ultima
          ? valorAlPrecio(
              consumoPorId[i.id] ?? 0,
              ultima.unitario,
              i.unidadMedida,
              i.unidadEtiqueta,
            )
          : null;
        return {
          producto: i.nombre,
          consumo: formatStockCompra(
            consumoPorId[i.id] ?? 0,
            i.unidadMedida,
            i.unidadEtiqueta,
          ),
          stock: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
          costo: costo == null ? "—" : formatRD(costo),
        };
      }),
    totalCompras: formatRD(
      compras.reduce((acc, m) => {
        const p = m.precioTotal == null ? 0 : toMoney(m.precioTotal);
        return acc + (p > 0 ? p : 0);
      }, 0),
    ),
    totalConsumo: formatRD(
      ventas.reduce((acc, m) => {
        const ultima = ultimas[m.ingredientId];
        const v = ultima
          ? valorAlPrecio(
              toMoney(m.cantidad),
              ultima.unitario,
              m.ingredient.unidadMedida,
              m.ingredient.unidadEtiqueta,
            )
          : null;
        return acc + (v ?? 0);
      }, 0),
    ),
    totalStock: formatRD(
      stock.reduce((acc, i) => {
        const ultima = ultimas[i.id];
        const v = ultima
          ? valorAlPrecio(
              toMoney(i.stockActual),
              ultima.unitario,
              i.unidadMedida,
              i.unidadEtiqueta,
            )
          : null;
        return acc + (v ?? 0);
      }, 0),
    ),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${registroPdfFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
