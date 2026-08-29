import { describe, expect, it } from "vitest";
import { coincideBusqueda, sumarConsumo } from "./inventory-consumo";

describe("sumarConsumo", () => {
  it("adds absolute sale quantities per product", () => {
    expect(
      sumarConsumo([
        { ingredientId: "arroz", cantidad: -2267.96 },
        { ingredientId: "arroz", cantidad: -453.592 },
        { ingredientId: "aceite", cantidad: -500 },
      ]),
    ).toEqual({
      arroz: 2721.552,
      aceite: 500,
    });
  });

  it("ignores zero movements", () => {
    expect(sumarConsumo([{ ingredientId: "arroz", cantidad: 0 }])).toEqual({});
  });
});

describe("coincideBusqueda", () => {
  it("matches without accents or case", () => {
    expect(coincideBusqueda("Aceite de oliva", "aceite")).toBe(true);
    expect(coincideBusqueda("Cebolla", "CEBO")).toBe(true);
    expect(coincideBusqueda("Limón", "limon")).toBe(true);
  });

  it("keeps every product when the query is empty", () => {
    expect(coincideBusqueda("Arroz", "")).toBe(true);
  });
});
