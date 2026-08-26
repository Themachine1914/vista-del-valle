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

/** 1 libra = 16 oz ≈ 453.592 g (uso de cocina en RD). */
export const GRAMS_PER_LB = 453.592;
export const GRAMS_PER_KG = 1000;

function formatPlain(n: number, maxFrac = 2): string {
  const rounded = Math.round(n * 10 ** maxFrac) / 10 ** maxFrac;
  return String(rounded);
}

export function formatStockCompra(
  value: Decimal | number | string,
  unidad: "G" | "ML" | "UD",
  etiqueta?: string | null,
): string {
  const n = toMoney(value);
  const e = (etiqueta ?? "").trim();
  const key = e.toLowerCase();
  if (
    key === "kg" ||
    key === "kilo" ||
    key === "kilos" ||
    key === "kilogramo" ||
    key === "kilogramos"
  ) {
    return `${formatPlain(n / GRAMS_PER_KG)} ${e}`;
  }
  if (key === "g" || key === "gr" || key === "gramo" || key === "gramos") {
    return `${formatPlain(n)} ${e}`;
  }
  if (key === "ml" || key === "mililitro" || key === "mililitros") {
    return `${formatPlain(n)} ${e}`;
  }
  if (e && unidad === "UD") {
    return `${formatPlain(n)} ${e}`;
  }
  if (unidad === "UD") {
    return `${formatPlain(n)} ud`;
  }
  if (unidad === "ML") {
    return `${formatPlain(n / 1000)} ${e || "L"}`;
  }
  return `${formatPlain(n / GRAMS_PER_LB)} ${e || "lb"}`;
}

export function formatFechaCorta(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const tz = "America/Santo_Domingo";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${day} ${time}`;
}

export function todayISO(timeZone = "America/Santo_Domingo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
