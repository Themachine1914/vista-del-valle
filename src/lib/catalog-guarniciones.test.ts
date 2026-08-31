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

const SALSAS = [
  "salsa-de-tamarindo",
  "salsa-del-bosque",
  "salsa-al-ajillo",
  "salsa-pomodoro",
  "salsa-alfredo-blanca",
  "salsa-romero",
  "salsa-del-rey",
  "salsa-blue-cheese",
];

const COMPRADA = new Set(["salsa-china", "salsa-bbq", "salsa-crema"]);

describe("recetas del cuaderno", () => {
  it("only keeps the dishes and sauces written in the kitchen notebook", () => {
    expect(recipes.map((r) => r.dishId).sort()).toEqual([...CUADERNO, ...SALSAS].sort());
  });

  it("gives the listed garnishes a recipe so a sale deducts inventory", () => {
    const withRecipe = new Set(recipes.map((r) => r.dishId));
    expect(["tostones", "casabe", "papas-fritas", "papas-salteadas", "aguacate"].filter((id) => !withRecipe.has(id))).toEqual([]);
  });

  it("builds salsa al ajillo from salsa del Bosque", () => {
    const ajillo = recipes.find((r) => r.dishId === "salsa-al-ajillo");
    expect(ajillo?.items.some(([id]) => id === "salsa-del-bosque")).toBe(true);
  });

  it("gives every house sauce used on a plate its own recipe", () => {
    const used = recipes
      .filter((r) => !SALSAS.includes(r.dishId))
      .flatMap((r) => r.items.map(([id]) => id))
      .filter((id) => id.startsWith("salsa-") && !COMPRADA.has(id));
    const withRecipe = new Set(recipes.map((r) => r.dishId));
    expect([...new Set(used)].filter((id) => !withRecipe.has(id))).toEqual([]);
  });
});
