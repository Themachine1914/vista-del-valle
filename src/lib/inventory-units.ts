import { GRAMS_PER_KG, GRAMS_PER_LB, GRAMS_PER_OZ } from "./money";

export type TipoEntrada = "LIBRA" | "ONZA" | "KILO" | "LITRO" | "ITEM" | "UNIDAD" | "OTRO";
export type TipoMinimo = "ONZA" | "LIBRA" | "ITEM" | "UNIDAD";
export type UnidadInterna = "G" | "ML" | "UD";

export const TIPOS_ENTRADA: { id: TipoEntrada; label: string }[] = [
  { id: "LIBRA", label: "Libra" },
  { id: "ONZA", label: "Onza" },
  { id: "KILO", label: "Kilo" },
  { id: "LITRO", label: "Litro" },
  { id: "ITEM", label: "Ítem" },
  { id: "UNIDAD", label: "Unidad" },
  { id: "OTRO", label: "Otra (escribir)" },
];

export const TIPOS_MINIMO: { id: TipoMinimo; label: string }[] = [
  { id: "ONZA", label: "Onza" },
  { id: "LIBRA", label: "Libra" },
  { id: "ITEM", label: "Ítem" },
  { id: "UNIDAD", label: "Unidad" },
];

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
  oz: "ONZA",
  onz: "ONZA",
  onza: "ONZA",
  onzas: "ONZA",
  kg: "KILO",
  kilo: "KILO",
  kilos: "KILO",
  kilogramo: "KILO",
  kilogramos: "KILO",
  l: "LITRO",
  litro: "LITRO",
  litros: "LITRO",
  item: "ITEM",
  items: "ITEM",
  ítem: "ITEM",
  ítems: "ITEM",
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
  if (tipo === "ONZA") return "oz";
  if (tipo === "KILO") return "kg";
  if (tipo === "LITRO") return "L";
  if (tipo === "ITEM") return "ítem";
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
  if (tipo === "ONZA") {
    return { tipo, etiqueta: "oz", unidadMedida: "G", factor: GRAMS_PER_OZ };
  }
  if (tipo === "KILO") {
    return { tipo, etiqueta: "kg", unidadMedida: "G", factor: GRAMS_PER_KG };
  }
  if (tipo === "LITRO") {
    return { tipo, etiqueta: "L", unidadMedida: "ML", factor: 1000 };
  }
  if (tipo === "ITEM") {
    return { tipo, etiqueta: "ítem", unidadMedida: "UD", factor: 1 };
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
  const r = resolveEntrada("OTRO", e);
  if (r.unidadMedida !== unidad) return "OTRO";
  return r.tipo;
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

/** Unidades visibles que coinciden con cómo se guarda el producto. */
export function tiposAjusteParaUnidad(unidad: UnidadInterna): TipoEntrada[] {
  if (unidad === "G") return ["LIBRA", "ONZA", "KILO", "OTRO"];
  if (unidad === "ML") return ["LITRO", "OTRO"];
  return ["ITEM", "UNIDAD", "OTRO"];
}

function etiquetaFamilia(unidad: UnidadInterna): string {
  if (unidad === "G") return "peso (libra, onza o kilo)";
  if (unidad === "ML") return "volumen (litro)";
  return "unidades o ítems";
}

/** Convierte un ajuste (cantidad + unidad elegida) a stock interno. */
export function ajusteToStock(params: {
  cantidad: number;
  tipoEntrada: TipoEntrada;
  unidadCustom?: string;
  unidadProducto: UnidadInterna;
}): { unidadMedida: UnidadInterna; cantidadStock: number; etiqueta: string } {
  if (params.cantidad === 0) {
    throw new Error("La cantidad no puede ser 0");
  }
  const r = resolveEntrada(params.tipoEntrada, params.unidadCustom);
  if (r.unidadMedida !== params.unidadProducto) {
    throw new Error(
      `Este producto se ajusta por ${etiquetaFamilia(params.unidadProducto)}, no en ${r.etiqueta}`,
    );
  }
  return {
    unidadMedida: r.unidadMedida,
    cantidadStock: Math.abs(params.cantidad) * r.factor,
    etiqueta: r.etiqueta,
  };
}

export function tipoMinimoDesdeEntrada(tipo: TipoEntrada): TipoMinimo {
  if (tipo === "ONZA") return "ONZA";
  if (tipo === "LIBRA" || tipo === "KILO") return "LIBRA";
  if (tipo === "ITEM") return "ITEM";
  return "UNIDAD";
}

export function etiquetaMinimo(tipo: TipoMinimo): string {
  if (tipo === "ONZA") return "oz";
  if (tipo === "LIBRA") return "lb";
  if (tipo === "ITEM") return "ítem";
  return "ud";
}

/** Convierte el mínimo (onza, libra, ítem o unidad) a la unidad interna de stock. */
export function minimoToStock(params: {
  valor: number;
  tipoMinimo: TipoMinimo;
  tipoEntrada: TipoEntrada;
  unidadCustom?: string;
  contenidoPorItem: number;
}): number {
  if (!(params.valor > 0)) return 0;
  const entrada = resolveEntrada(params.tipoEntrada, params.unidadCustom);
  const contenido = params.contenidoPorItem > 0 ? params.contenidoPorItem : 1;

  if (params.tipoMinimo === "ITEM") {
    return params.valor * contenido * entrada.factor;
  }
  if (params.tipoMinimo === "UNIDAD") {
    if (entrada.unidadMedida === "UD") {
      return params.valor * entrada.factor;
    }
    return params.valor * contenido * entrada.factor;
  }
  if (params.tipoMinimo === "ONZA") {
    if (entrada.unidadMedida === "G") return params.valor * GRAMS_PER_OZ;
    if (entrada.unidadMedida === "UD") return params.valor;
    return params.valor * contenido * entrada.factor;
  }
  if (entrada.unidadMedida === "G") return params.valor * GRAMS_PER_LB;
  if (entrada.unidadMedida === "UD") return params.valor;
  return params.valor * contenido * entrada.factor;
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
