import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatFechaCorta, formatStockCompra, toMoney } from "@/lib/money";
import { parsePeriodo, type PeriodoFiltro } from "@/lib/period";
import { InventarioClient } from "@/components/app/InventarioClient";
import { redirect } from "next/navigation";
import { sumarConsumo } from "@/lib/inventory-consumo";
import {
  comparacionVsAnterior,
  etiquetaPrecioCompra,
  ultimasComprasPorProducto,
  type MovimientoPrecio,
} from "@/lib/inventory-precio";

export const dynamic = "force-dynamic";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    fecha?: string;
    mes?: string;
    anio?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const canAdjust = session?.user.role === "ADMIN";
  const sp = await searchParams;
  const periodo = parsePeriodo({ ...sp, periodo: sp.periodo ?? "mes" });
  const range = { gte: periodo.gte, lt: periodo.lt };

  const [ingredients, audits, compras, entradas, ventas] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
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
    prisma.inventoryMovement.findMany({
      where: { tipo: "ENTRADA" },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      include: {
        ingredient: { select: { unidadMedida: true, unidadEtiqueta: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: { tipo: "VENTA", fecha: range },
      select: { ingredientId: true, cantidad: true },
    }),
  ]);
  const consumoPorId = sumarConsumo(
    ventas.map((m) => ({
      ingredientId: m.ingredientId,
      cantidad: toMoney(m.cantidad),
    })),
  );
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
  const rows = ingredients.map((i) => {
    const consumo = consumoPorId[i.id] ?? 0;
    return {
      id: i.id,
      nombre: i.nombre,
      unidadMedida: i.unidadMedida,
      unidadEtiqueta: i.unidadEtiqueta,
      stockActual: toMoney(i.stockActual),
      stockMinimo: toMoney(i.stockMinimo),
      bajo: toMoney(i.stockActual) < toMoney(i.stockMinimo),
      etiqueta: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
      minimoEtiqueta: formatStockCompra(i.stockMinimo, i.unidadMedida, i.unidadEtiqueta),
      consumo,
      consumoEtiqueta:
        consumo > 0
          ? formatStockCompra(consumo, i.unidadMedida, i.unidadEtiqueta)
          : "—",
    };
  });
  const filtro: PeriodoFiltro = {
    modo: periodo.modo,
    fecha: periodo.fecha,
    mes: periodo.mes,
    anio: periodo.anio,
    desde: periodo.desde,
    hasta: periodo.hasta,
    label: periodo.label,
  };
  const resumen = {
    altas: audits.filter((a) => a.accion === "ALTA").length,
    bajas: audits.filter((a) => a.accion === "BAJA").length,
    cambios: audits.filter((a) => a.accion === "RENOMBRE").length,
    compras: compras.length,
    consumo: Object.keys(consumoPorId).length,
  };
  return (
    <InventarioClient
      rows={rows}
      canAdjust={canAdjust}
      periodo={filtro}
      resumen={resumen}
      audits={audits.map((a) => ({
        id: a.id,
        accion: a.accion,
        nombre: a.nombre,
        detalle: a.detalle,
        usuario: a.user?.name ?? "Sistema",
        createdAt: formatFechaCorta(a.createdAt),
      }))}
      compras={compras.map((m) => {
        const precio = etiquetaPrecioCompra(
          m.precioTotal == null ? null : toMoney(m.precioTotal),
          toMoney(m.cantidad),
          m.ingredient.unidadMedida,
          m.ingredient.unidadEtiqueta,
        );
        const vs = comparacionVsAnterior(
          {
            id: m.id,
            ingredientId: m.ingredientId,
            cantidad: toMoney(m.cantidad),
            precioTotal: m.precioTotal == null ? null : toMoney(m.precioTotal),
            fecha: m.fecha,
            createdAt: m.createdAt,
            unidadMedida: m.ingredient.unidadMedida,
            unidadEtiqueta: m.ingredient.unidadEtiqueta,
          },
          historial,
        );
        return {
          id: m.id,
          producto: m.ingredient.nombre,
          nota: m.nota,
          etiqueta: formatStockCompra(
            m.cantidad,
            m.ingredient.unidadMedida,
            m.ingredient.unidadEtiqueta,
          ),
          usuario: m.user?.name ?? "Sistema",
          fecha: formatFechaCorta(m.fecha),
          precio: precio.total,
          unitario: precio.unitario,
          vsAnterior: vs
            ? { delta: vs.delta, fechaAnterior: vs.fechaAnterior }
            : null,
        };
      })}
      ultimas={ultimas}
      defaultFecha={periodo.fecha}
    />
  );
}
