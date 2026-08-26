import { describe, expect, it } from "vitest";
import { computeDeductionQty } from "./inventory";
import { GRAMS_PER_LB } from "./money";
import { purchaseToStock } from "./inventory-units";

describe("computeDeductionQty", () => {
  it("deducts the exact recipe quantity when units sold equals the yield", () => {
    const qty = computeDeductionQty(500, 4, 4);
    expect(qty.toNumber()).toBe(500);
  });

  it("scales down when fewer units are sold than the recipe yields", () => {
    // recipe yields 4 servings from 500g; selling 1 serving uses a quarter
    const qty = computeDeductionQty(500, 4, 1);
    expect(qty.toNumber()).toBe(125);
  });

  it("scales up when more units are sold than the recipe yields", () => {
    // a single-serving recipe (porcionesQueRinde=1) sold 10 times
    const qty = computeDeductionQty(50, 1, 10);
    expect(qty.toNumber()).toBe(500);
  });

  it("accepts string and Decimal-like recipe quantities without precision loss", () => {
    const qty = computeDeductionQty("33.33", 3, 1);
    expect(qty.toNumber()).toBeCloseTo(11.11, 2);
  });

  it("throws instead of silently corrupting stock when porcionesQueRinde is 0", () => {
    expect(() => computeDeductionQty(100, 0, 1)).toThrow(
      "porcionesQueRinde debe ser mayor que 0",
    );
  });

  it("throws when porcionesQueRinde is negative", () => {
    expect(() => computeDeductionQty(100, -2, 1)).toThrow(
      "porcionesQueRinde debe ser mayor que 0",
    );
  });

  it("returns zero deduction when zero units are sold", () => {
    const qty = computeDeductionQty(500, 4, 0);
    expect(qty.toNumber()).toBe(0);
  });
});

describe("purchaseToStock", () => {
  it("converts 2 sacks of 25 lb to grams", () => {
    const r = purchaseToStock({
      tipoEntrada: "LIBRA",
      cantidadItems: 2,
      contenidoPorItem: 25,
    });
    expect(r.unidadMedida).toBe("G");
    expect(r.cantidadStock).toBeCloseTo(50 * GRAMS_PER_LB, 5);
  });

  it("converts liters to milliliters", () => {
    const r = purchaseToStock({
      tipoEntrada: "LITRO",
      cantidadItems: 3,
      contenidoPorItem: 1.5,
    });
    expect(r).toEqual({ unidadMedida: "ML", cantidadStock: 4500 });
  });

  it("keeps units as units", () => {
    const r = purchaseToStock({
      tipoEntrada: "UNIDAD",
      cantidadItems: 2,
      contenidoPorItem: 12,
    });
    expect(r).toEqual({ unidadMedida: "UD", cantidadStock: 24 });
  });

  it("rejects zero items", () => {
    expect(() =>
      purchaseToStock({
        tipoEntrada: "LIBRA",
        cantidadItems: 0,
        contenidoPorItem: 25,
      }),
    ).toThrow("La cantidad debe ser mayor que 0");
  });
});
