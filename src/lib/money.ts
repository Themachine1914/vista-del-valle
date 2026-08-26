import { Decimal } from "@prisma/client/runtime/library";

export function toMoney(value: Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export function formatRD(value: Decimal | number | string | null | undefined): string {
  const n = toMoney(value);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatQty(
  value: Decimal | number | string,
  unidad: "G" | "ML" | "UD",
): string {
  const n = toMoney(value);
  if (unidad === "UD") {
    return `${n.toLocaleString("es-DO")} ud`;
  }
  if (unidad === "ML") {
    return n >= 1000 ? `${(n / 1000).toLocaleString("es-DO")} L` : `${n.toLocaleString("es-DO")} ml`;
  }
  return n >= 1000 ? `${(n / 1000).toLocaleString("es-DO")} kg` : `${n.toLocaleString("es-DO")} g`;
}
