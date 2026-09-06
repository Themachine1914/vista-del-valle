import { describe, expect, it } from "vitest";
import { computePrepQty, etiquetaLotes, wouldCreateCycle } from "./prep-recipe";

describe("computePrepQty", () => {
  it("uses the full batch when lotes is 1", () => {
    expect(computePrepQty(2000, 1).toNumber()).toBe(2000);
  });

  it("scales up for two batches", () => {
    expect(computePrepQty(2000, 2).toNumber()).toBe(4000);
  });

  it("scales down for a half batch", () => {
    expect(computePrepQty(3785.41, 0.5).toNumber()).toBeCloseTo(1892.705, 3);
  });

  it("throws when lotes is 0", () => {
    expect(() => computePrepQty(100, 0)).toThrow("Los lotes deben ser mayor que 0");
  });

  it("throws when lotes is negative", () => {
    expect(() => computePrepQty(100, -1)).toThrow("Los lotes deben ser mayor que 0");
  });
});

describe("wouldCreateCycle", () => {
  const graph = [
    { outputIngredientId: "alfredo", inputIngredientIds: ["crema", "leche"] },
    { outputIngredientId: "rey", inputIngredientIds: ["alfredo", "morron"] },
  ];

  it("allows a sauce built from another sauce", () => {
    expect(wouldCreateCycle("rey", ["alfredo", "morron"], graph)).toBe(false);
  });

  it("rejects using the output as an input", () => {
    expect(wouldCreateCycle("alfredo", ["crema", "alfredo"], graph)).toBe(true);
  });

  it("rejects Alfredo if it consumed Salsa del Rey (which is made from Alfredo)", () => {
    expect(wouldCreateCycle("alfredo", ["rey"], graph)).toBe(true);
  });

  it("allows an unrelated new sauce", () => {
    expect(wouldCreateCycle("tamarindo", ["tamarindo-crudo", "ajo"], graph)).toBe(
      false,
    );
  });

  it("treats a replacement of the same recipe as non-cyclic", () => {
    expect(wouldCreateCycle("alfredo", ["crema", "mantequilla"], graph)).toBe(
      false,
    );
  });
});

describe("etiquetaLotes", () => {
  it("singularizes one lote", () => {
    expect(etiquetaLotes(1)).toBe("1 lote");
  });

  it("pluralizes other amounts", () => {
    expect(etiquetaLotes(2)).toBe("2 lotes");
    expect(etiquetaLotes(0.5)).toBe("0.5 lotes");
  });
});
