export const TURNO_LABEL: Record<string, string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  CENA: "Cena",
};

export function etiquetaDesglose(
  clave: string,
  modo: "dia" | "mes" | "anio" | "rango",
): string {
  if (modo === "dia") return TURNO_LABEL[clave] ?? clave;
  if (/^\d{4}-\d{2}$/.test(clave)) {
    const [y, m] = clave.split("-");
    const nombres = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    return `${nombres[Number(m) - 1]} ${y}`;
  }
  return clave;
}
