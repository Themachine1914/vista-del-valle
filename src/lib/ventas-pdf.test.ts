import { describe, expect, it } from "vitest";
import { buildVentasPdf } from "./ventas-pdf";

describe("buildVentasPdf", () => {
  it("produces a PDF document", () => {
    const bytes = buildVentasPdf({
      generadoPor: "Administradora",
      periodoLabel: "agosto 2026",
      desgloseModo: "mes",
      total: 2445,
      unidades: 3,
      desglose: [{ clave: "2026-08-26", unidades: 3, total: 2445 }],
      lineas: [
        {
          fecha: "2026-08-26",
          turno: "ALMUERZO",
          plato: "Chivo del Valle",
          garnish: "Aguacate",
          cantidad: 1,
          precio: 960,
          total: 960,
          camarero: "Camarero",
        },
      ],
    });
    const header = Buffer.from(bytes.slice(0, 5)).toString("utf8");
    expect(header).toBe("%PDF-");
  });
});
