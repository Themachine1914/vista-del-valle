/** Suma salidas de venta (cantidades negativas) por producto. */
export function sumarConsumo(
  movimientos: { ingredientId: string; cantidad: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of movimientos) {
    const qty = Math.abs(m.cantidad);
    if (!(qty > 0)) continue;
    out[m.ingredientId] = (out[m.ingredientId] ?? 0) + qty;
  }
  return out;
}

export function normalizarBusqueda(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function coincideBusqueda(nombre: string, query: string): boolean {
  const q = normalizarBusqueda(query);
  if (!q) return true;
  return normalizarBusqueda(nombre).includes(q);
}
