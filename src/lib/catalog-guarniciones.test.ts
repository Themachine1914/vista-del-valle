import { describe, expect, it } from "vitest";
import { recipes } from "../../prisma/catalog";

const CUADERNO = [
  "tostones",
  "casabe",
  "papas-fritas",
  "papas-salteadas",
  "aguacate",
  "bistec-encebollado",
  "arroz-mariscos",
  "salmon-bosque",
  "canastitas-pollo",
  "canastitas-camarones",
  "asopao-camarones",
  "asopao-mariscos",
  "pasta-tomate",
  "pasta-tomate-camarones",
  "pasta-tocineta",
  "pasta-alfredo-pollo",
  "pasta-alfredo-camarones",
  "filete-res-queso-azul",
  "filete-res-parrilla",
  "pechuga-crema",
  "pechuga-salsa-rey",
  "conejo",
];

describe("recetas del cuaderno", () => {
  it("only keeps the dishes written in the kitchen notebook", () => {
    expect(recipes.map((r) => r.dishId).sort()).toEqual([...CUADERNO].sort());
  });

  it("gives the listed garnishes a recipe so a sale deducts inventory", () => {
    const withRecipe = new Set(recipes.map((r) => r.dishId));
    expect(["tostones", "casabe", "papas-fritas", "papas-salteadas", "aguacate"].filter((id) => !withRecipe.has(id))).toEqual([]);
  });
});
