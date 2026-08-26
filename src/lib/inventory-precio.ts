import { precioPorUnidad, type UnidadInterna } from "./inventory-units";
import { formatFechaCorta, formatRD, formatRDUnitario } from "./money";

export type MovimientoPrecio = {
  id: string;
  ingredientId: string;
  cantidad: number;
  precioTotal: number | null;
  fecha: Date;
  createdAt: Date;
  unidadMedida: UnidadInterna;
  unidadEtiqueta: string;
};

export type UltimaCompra = {
  fecha: string;
  precioTotal: number;
  unitario: number;
  etiquetaUnidad: string;
};

export function etiquetaPrecioCompra(
  precioTotal: number | null,
  cantidad: number,
  unidad: UnidadInterna,
  etiqueta?: string | null,
): { total: string; unitario: string; unitarioNum: number | null } {
  if (precioTotal == null || !(precioTotal > 0)) {
    return { total: "—", unitario: "—", unitarioNum: null };
  }
  const u = precioPorUnidad(precioTotal, cantidad, unidad, etiqueta);
  const e = (etiqueta ?? "").trim() || "ud";
  return {
    total: formatRD(precioTotal),
    unitario: u == null ? "—" : `${formatRDUnitario(u)} / ${e}`,
    unitarioNum: u,
  };
}

export function ultimasComprasPorProducto(
  movimientos: MovimientoPrecio[],
): Record<string, UltimaCompra> {
  const sorted = [...movimientos].sort(
    (a, b) =>
      b.fecha.getTime() - a.fecha.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const out: Record<string, UltimaCompra> = {};
  for (const m of sorted) {
    if (out[m.ingredientId] || m.precioTotal == null || !(m.precioTotal > 0)) {
      continue;
    }
    const unitario = precioPorUnidad(
      m.precioTotal,
      m.cantidad,
      m.unidadMedida,
      m.unidadEtiqueta,
    );
    if (unitario == null) continue;
    out[m.ingredientId] = {
      fecha: formatFechaCorta(m.fecha),
      precioTotal: m.precioTotal,
      unitario,
      etiquetaUnidad: (m.unidadEtiqueta || "ud").trim() || "ud",
    };
  }
  return out;
}

export function comparacionVsAnterior(
  actual: MovimientoPrecio,
  historial: MovimientoPrecio[],
): { delta: number; fechaAnterior: string } | null {
  const same = historial
    .filter((h) => h.ingredientId === actual.ingredientId)
    .sort(
      (a, b) =>
        a.fecha.getTime() - b.fecha.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const idx = same.findIndex((h) => h.id === actual.id);
  if (idx <= 0) return null;
  const actualU =
    actual.precioTotal != null
      ? precioPorUnidad(
          actual.precioTotal,
          actual.cantidad,
          actual.unidadMedida,
          actual.unidadEtiqueta,
        )
      : null;
  if (actualU == null) return null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const prev = same[i];
    if (prev.precioTotal == null || !(prev.precioTotal > 0)) continue;
    const prevU = precioPorUnidad(
      prev.precioTotal,
      prev.cantidad,
      prev.unidadMedida,
      prev.unidadEtiqueta,
    );
    if (prevU == null) continue;
    return { delta: actualU - prevU, fechaAnterior: formatFechaCorta(prev.fecha) };
  }
  return null;
}
