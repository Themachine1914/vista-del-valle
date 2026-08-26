import { GRAMS_PER_LB } from "./money";

export type TipoEntrada = "LIBRA" | "LITRO" | "UNIDAD";

export function unidadFromTipo(tipo: TipoEntrada): "G" | "ML" | "UD" {
  if (tipo === "LIBRA") return "G";
  if (tipo === "LITRO") return "ML";
  return "UD";
}

export function tipoFromUnidad(unidad: "G" | "ML" | "UD"): TipoEntrada {
  if (unidad === "G") return "LIBRA";
  if (unidad === "ML") return "LITRO";
  return "UNIDAD";
}

export function etiquetaTipo(tipo: TipoEntrada): string {
  if (tipo === "LIBRA") return "lb";
  if (tipo === "LITRO") return "L";
  return "ud";
}

/** Convierte una compra (ítems × contenido) a la unidad interna de stock. */
export function purchaseToStock(params: {
  tipoEntrada: TipoEntrada;
  cantidadItems: number;
  contenidoPorItem: number;
}): { unidadMedida: "G" | "ML" | "UD"; cantidadStock: number } {
  if (params.cantidadItems <= 0) {
    throw new Error("La cantidad debe ser mayor que 0");
  }
  const contenido = params.contenidoPorItem > 0 ? params.contenidoPorItem : 1;
  const total = params.cantidadItems * contenido;
  if (params.tipoEntrada === "LIBRA") {
    return { unidadMedida: "G", cantidadStock: total * GRAMS_PER_LB };
  }
  if (params.tipoEntrada === "LITRO") {
    return { unidadMedida: "ML", cantidadStock: total * 1000 };
  }
  return { unidadMedida: "UD", cantidadStock: total };
}
