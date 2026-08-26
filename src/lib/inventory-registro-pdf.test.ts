import { describe, expect, it } from "vitest";
import { buildInventarioRegistroPdf } from "./inventory-registro-pdf";

describe("buildInventarioRegistroPdf", () => {
  it("produces a PDF document", () => {
    const bytes = buildInventarioRegistroPdf({
      generadoPor: "Administradora",
      audits: [
        {
          createdAt: "2026-08-26 17:00",
          accion: "ALTA",
          nombre: "Arroz",
          detalle: "Producto nuevo · lb",
          usuario: "Administradora",
        },
      ],
      compras: [
        {
          fecha: "2026-08-26 17:00",
          producto: "Arroz",
          etiqueta: "50 lb",
          nota: "2 × 25 lb",
          usuario: "Administradora",
        },
      ],
      stock: [{ nombre: "Arroz", stock: "50 lb", minimo: "10 lb" }],
    });
    const header = Buffer.from(bytes.slice(0, 5)).toString("utf8");
    expect(header).toBe("%PDF-");
  });
});
