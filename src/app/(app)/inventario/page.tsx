import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatFechaCorta, formatRD, formatRDUnitario, formatStockCompra, toMoney } from "@/lib/money";
import { parsePeriodo, type PeriodoFiltro } from "@/lib/period";
import { InventarioClient } from "@/components/app/InventarioClient";
import { redirect } from "next/navigation";
import { sumarConsumo } from "@/lib/inventory-consumo";
import {
  comparacionVsAnterior,
  etiquetaPrecioCompra,
  ultimasComprasPorProducto,
  valorAlPrecio,
  type MovimientoPrecio,
} from "@/lib/inventory-precio";
import {
  etiquetaEnvase,
  resolverContenidoPorItem,
} from "@/lib/inventory-units";

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

  const [ingredients, audits, movimientosPeriodo, entradas] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
    prisma.inventoryAudit.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { fecha: range },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
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
  ]);
  const compras = movimientosPeriodo.filter((m) => m.tipo === "ENTRADA");
  const ventas = movimientosPeriodo.filter((m) => m.tipo === "VENTA");
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
  const ultimaNotaPorId = new Map<string, string>();
  for (const m of entradas) {
    if (m.nota && !ultimaNotaPorId.has(m.ingredientId)) {
      ultimaNotaPorId.set(m.ingredientId, m.nota);
    }
  }
  const rows = ingredients.map((i) => {
    const consumo = consumoPorId[i.id] ?? 0;
    const ultima = ultimas[i.id];
    const stockNum = toMoney(i.stockActual);
    const contenidoPorItem = resolverContenidoPorItem(
      toMoney(i.contenidoPorItem),
      ultimaNotaPorId.get(i.id),
    );
    const valorStock = ultima
      ? valorAlPrecio(stockNum, ultima.unitario, i.unidadMedida, i.unidadEtiqueta)
      : null;
    const costoConsumo = ultima
      ? valorAlPrecio(consumo, ultima.unitario, i.unidadMedida, i.unidadEtiqueta)
      : null;
    return {
      id: i.id,
      nombre: i.nombre,
      unidadMedida: i.unidadMedida,
      unidadEtiqueta: i.unidadEtiqueta,
      contenidoPorItem,
      envaseEtiqueta: etiquetaEnvase(contenidoPorItem, i.unidadMedida, i.unidadEtiqueta),
      stockActual: stockNum,
      stockMinimo: toMoney(i.stockMinimo),
      bajo: stockNum < toMoney(i.stockMinimo),
      etiqueta: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
      minimoEtiqueta: formatStockCompra(i.stockMinimo, i.unidadMedida, i.unidadEtiqueta),
      consumo,
      consumoEtiqueta:
        consumo > 0
          ? formatStockCompra(consumo, i.unidadMedida, i.unidadEtiqueta)
          : "—",
      precioEtiqueta: ultima
        ? `${formatRDUnitario(ultima.unitario)} / ${ultima.etiquetaUnidad}`
        : "—",
      valorStockEtiqueta: valorStock == null ? "—" : formatRD(valorStock),
      costoConsumoEtiqueta: costoConsumo == null ? "—" : formatRD(costoConsumo),
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
  const valorCompras = compras.reduce((acc, m) => {
    const p = m.precioTotal == null ? 0 : toMoney(m.precioTotal);
    return acc + (p > 0 ? p : 0);
  }, 0);
  const valorConsumo = ventas.reduce((acc, m) => {
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
  }, 0);
  const valorStock = ingredients.reduce((acc, i) => {
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
  }, 0);
  const resumen = {
    altas: audits.filter((a) => a.accion === "ALTA").length,
    bajas: audits.filter((a) => a.accion === "BAJA").length,
    cambios: audits.filter((a) => a.accion === "RENOMBRE").length,
    compras: compras.length,
    consumo: Object.keys(consumoPorId).length,
    valorCompras: formatRD(valorCompras),
    valorConsumo: formatRD(valorConsumo),
    valorStock: formatRD(valorStock),
  };
  return (
    <InventarioClient
      rows={rows}
      canAdjust={canAdjust}
      periodo={filtro}
      resumen={resumen}
      movimientos={movimientosPeriodo.map((m) => {
        const ultima = ultimas[m.ingredientId];
        const guardado =
          m.precioTotal == null ? null : toMoney(m.precioTotal);
        const estimado = ultima
          ? valorAlPrecio(
              toMoney(m.cantidad),
              ultima.unitario,
              m.ingredient.unidadMedida,
              m.ingredient.unidadEtiqueta,
            )
          : null;
        const total =
          m.tipo === "ENTRADA" && guardado != null && guardado > 0
            ? guardado
            : estimado;
        return {
          id: m.id,
          fecha: formatFechaCorta(m.fecha),
          tipo: m.tipo,
          producto: m.ingredient.nombre,
          etiqueta: formatStockCompra(
            Math.abs(toMoney(m.cantidad)),
            m.ingredient.unidadMedida,
            m.ingredient.unidadEtiqueta,
          ),
          precio: total == null ? "—" : formatRD(total),
          nota: m.nota,
          usuario: m.user?.name ?? "Sistema",
        };
      })}
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
