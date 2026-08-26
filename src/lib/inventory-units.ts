import { GRAMS_PER_KG, GRAMS_PER_LB } from "./money";

export type TipoEntrada = "LIBRA" | "KILO" | "LITRO" | "UNIDAD" | "OTRO";
export type UnidadInterna = "G" | "ML" | "UD";

export type EntradaResuelta = {
  tipo: TipoEntrada;
  etiqueta: string;
  unidadMedida: UnidadInterna;
  factor: number;
};

const ALIAS: Record<string, TipoEntrada> = {
  lb: "LIBRA",
  libra: "LIBRA",
  libras: "LIBRA",
  kg: "KILO",
  kilo: "KILO",
  kilos: "KILO",
  kilogramo: "KILO",
  kilogramos: "KILO",
  l: "LITRO",
  litro: "LITRO",
  litros: "LITRO",
  ud: "UNIDAD",
  unidad: "UNIDAD",
  unidades: "UNIDAD",
};

const ESPECIAL: Record<string, { unidadMedida: UnidadInterna; factor: number }> = {
  g: { unidadMedida: "G", factor: 1 },
  gr: { unidadMedida: "G", factor: 1 },
  gramo: { unidadMedida: "G", factor: 1 },
  gramos: { unidadMedida: "G", factor: 1 },
  ml: { unidadMedida: "ML", factor: 1 },
  mililitro: { unidadMedida: "ML", factor: 1 },
  mililitros: { unidadMedida: "ML", factor: 1 },
};

export function etiquetaTipo(tipo: TipoEntrada, custom = ""): string {
  if (tipo === "LIBRA") return "lb";
  if (tipo === "KILO") return "kg";
  if (tipo === "LITRO") return "L";
  if (tipo === "OTRO") return custom.trim() || "ud";
  return "ud";
}

export function resolveEntrada(tipo: TipoEntrada, custom = ""): EntradaResuelta {
  if (tipo === "OTRO") {
    const raw = custom.trim();
    if (!raw) {
      throw new Error("Escribe la unidad, por ejemplo kg, caja o saco");
    }
    const key = raw.toLowerCase();
    const alias = ALIAS[key];
    if (alias) return resolveEntrada(alias);
    const especial = ESPECIAL[key];
    if (especial) {
      return { tipo: "OTRO", etiqueta: raw, ...especial };
    }
    return { tipo: "OTRO", etiqueta: raw, unidadMedida: "UD", factor: 1 };
  }
  if (tipo === "LIBRA") {
    return { tipo, etiqueta: "lb", unidadMedida: "G", factor: GRAMS_PER_LB };
  }
  if (tipo === "KILO") {
    return { tipo, etiqueta: "kg", unidadMedida: "G", factor: GRAMS_PER_KG };
  }
  if (tipo === "LITRO") {
    return { tipo, etiqueta: "L", unidadMedida: "ML", factor: 1000 };
  }
  return { tipo: "UNIDAD", etiqueta: "ud", unidadMedida: "UD", factor: 1 };
}

export function unidadFromTipo(tipo: TipoEntrada, custom = ""): UnidadInterna {
  return resolveEntrada(tipo === "OTRO" && !custom.trim() ? "UNIDAD" : tipo, custom)
    .unidadMedida;
}

export function tipoFromUnidad(unidad: UnidadInterna): TipoEntrada {
  if (unidad === "G") return "LIBRA";
  if (unidad === "ML") return "LITRO";
  return "UNIDAD";
}

export function tipoFromIngredient(
  unidad: UnidadInterna,
  etiqueta?: string | null,
): TipoEntrada {
  const e = (etiqueta ?? "").trim();
  if (!e) return tipoFromUnidad(unidad);
  return resolveEntrada("OTRO", e).tipo;
}

export function customFromIngredient(
  unidad: UnidadInterna,
  etiqueta?: string | null,
): string {
  const tipo = tipoFromIngredient(unidad, etiqueta);
  if (tipo !== "OTRO") return "";
  return (etiqueta ?? "").trim();
}

/** Convierte una compra (ítems × contenido) a la unidad interna de stock. */
export function purchaseToStock(params: {
  tipoEntrada: TipoEntrada;
  unidadCustom?: string;
  cantidadItems: number;
  contenidoPorItem: number;
}): { unidadMedida: UnidadInterna; cantidadStock: number; etiqueta: string } {
  if (params.cantidadItems <= 0) {
    throw new Error("La cantidad debe ser mayor que 0");
  }
  const r = resolveEntrada(params.tipoEntrada, params.unidadCustom);
  const contenido = params.contenidoPorItem > 0 ? params.contenidoPorItem : 1;
  return {
    unidadMedida: r.unidadMedida,
    cantidadStock: params.cantidadItems * contenido * r.factor,
    etiqueta: r.etiqueta,
  };
}

export function stockToDisplay(
  value: number,
  unidad: UnidadInterna,
  etiqueta?: string | null,
): number {
  const r = resolveEntrada(tipoFromIngredient(unidad, etiqueta), etiqueta ?? "");
  return r.factor === 0 ? 0 : value / r.factor;
}

export function displayToStock(
  display: number,
  tipo: TipoEntrada,
  custom = "",
): number {
  if (!(display > 0)) return 0;
  return purchaseToStock({
    tipoEntrada: tipo,
    unidadCustom: custom,
    cantidadItems: 1,
    contenidoPorItem: display,
  }).cantidadStock;
}

/** Precio pagado dividido entre la cantidad visible (lb, kg, L, ud). */
export function precioPorUnidad(
  precioTotal: number,
  cantidadStock: number,
  unidad: UnidadInterna,
  etiqueta?: string | null,
): number | null {
  const display = stockToDisplay(cantidadStock, unidad, etiqueta);
  if (!(precioTotal > 0) || !(display > 0)) return null;
  return precioTotal / display;
}
