import { describe, expect, it } from "vitest";
import { GRAMS_PER_LB } from "./money";
import { precioPorUnidad } from "./inventory-units";
import {
  comparacionVsAnterior,
  etiquetaPrecioCompra,
  ultimasComprasPorProducto,
  valorAlPrecio,
  valorConsumoMovimiento,
  type MovimientoPrecio,
} from "./inventory-precio";

function mov(
  partial: Partial<MovimientoPrecio> & Pick<MovimientoPrecio, "id" | "fecha">,
): MovimientoPrecio {
  return {
    ingredientId: "arroz",
    cantidad: 50 * GRAMS_PER_LB,
    precioTotal: 1200,
    createdAt: partial.fecha,
    unidadMedida: "G",
    unidadEtiqueta: "lb",
    ...partial,
  };
}

describe("precioPorUnidad", () => {
  it("divides the paid total by the visible quantity", () => {
    expect(precioPorUnidad(1200, 50 * GRAMS_PER_LB, "G", "lb")).toBeCloseTo(24, 5);
  });

  it("returns null without price or quantity", () => {
    expect(precioPorUnidad(0, 50 * GRAMS_PER_LB, "G", "lb")).toBeNull();
    expect(precioPorUnidad(1200, 0, "G", "lb")).toBeNull();
  });
});

describe("etiquetaPrecioCompra", () => {
  it("formats total and unit price", () => {
    const e = etiquetaPrecioCompra(1200, 50 * GRAMS_PER_LB, "G", "lb");
    expect(e.total).toBe("RD$1,200");
    expect(e.unitario).toBe("RD$24.00 / lb");
    expect(e.unitarioNum).toBeCloseTo(24, 5);
  });

  it("uses em dash when there is no price", () => {
    expect(etiquetaPrecioCompra(null, 50, "G", "lb")).toEqual({
      total: "—",
      unitario: "—",
      unitarioNum: null,
    });
  });
});

describe("ultimasComprasPorProducto", () => {
  it("keeps the newest priced purchase per product", () => {
    const ultimas = ultimasComprasPorProducto([
      mov({ id: "old", fecha: new Date("2026-08-01T12:00:00"), precioTotal: 1000 }),
      mov({ id: "new", fecha: new Date("2026-08-20T12:00:00"), precioTotal: 1300 }),
      mov({
        id: "other",
        ingredientId: "aceite",
        fecha: new Date("2026-08-10T12:00:00"),
        cantidad: 10,
        unidadMedida: "UD",
        unidadEtiqueta: "ud",
        precioTotal: 500,
      }),
    ]);
    expect(ultimas.arroz.precioTotal).toBe(1300);
    expect(ultimas.aceite.precioTotal).toBe(500);
  });
});

describe("valorAlPrecio", () => {
  it("multiplies visible stock by the last unit price", () => {
    expect(valorAlPrecio(50 * GRAMS_PER_LB, 24, "G", "lb")).toBeCloseTo(1200, 5);
  });

  it("values consumed quantity the same way", () => {
    expect(valorAlPrecio(8 * GRAMS_PER_LB, 24, "G", "lb")).toBeCloseTo(192, 5);
  });

  it("returns null without a unit price", () => {
    expect(valorAlPrecio(50 * GRAMS_PER_LB, null, "G", "lb")).toBeNull();
  });
});

describe("valorConsumoMovimiento", () => {
  it("adds cost on a sale and subtracts it on a void", () => {
    const sale = valorConsumoMovimiento(-8 * GRAMS_PER_LB, 24, "G", "lb");
    const voided = valorConsumoMovimiento(8 * GRAMS_PER_LB, 24, "G", "lb");
    expect(sale).toBeCloseTo(192, 5);
    expect(voided).toBeCloseTo(-192, 5);
    expect(sale + voided).toBeCloseTo(0, 5);
  });
});

describe("comparacionVsAnterior", () => {
  it("returns the unit-price delta against the previous purchase", () => {
    const older = mov({
      id: "old",
      fecha: new Date("2026-08-01T12:00:00"),
      precioTotal: 1000,
    });
    const newer = mov({
      id: "new",
      fecha: new Date("2026-08-20T12:00:00"),
      precioTotal: 1200,
    });
    const cmp = comparacionVsAnterior(newer, [newer, older]);
    expect(cmp?.delta).toBeCloseTo(4, 5);
  });
});
