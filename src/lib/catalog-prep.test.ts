import { describe, expect, it } from "vitest";
import { ingredients, prepRecipes } from "../../prisma/catalog";
import { wouldCreateCycle } from "./prep-recipe";

describe("prep recipe catalog", () => {
  const ids = new Set(ingredients.map((i) => i.id));

  it("points every prep at a real output product", () => {
    const missing = prepRecipes.filter((p) => !ids.has(p.outputIngredientId));
    expect(missing.map((p) => p.outputIngredientId)).toEqual([]);
  });

  it("only uses ingredients that exist", () => {
    const missing = prepRecipes.flatMap((p) =>
      p.items.filter(([id]) => !ids.has(id)).map(([id]) => `${p.id}:${id}`),
    );
    expect(missing).toEqual([]);
  });

  it("does not consume its own output", () => {
    for (const p of prepRecipes) {
      expect(p.items.some(([id]) => id === p.outputIngredientId)).toBe(false);
    }
  });

  it("has unique output products", () => {
    const outputs = prepRecipes.map((p) => p.outputIngredientId);
    expect(new Set(outputs).size).toBe(outputs.length);
  });

  it("does not form a cycle between seeded preps", () => {
    const graph = prepRecipes.map((p) => ({
      outputIngredientId: p.outputIngredientId,
      inputIngredientIds: p.items.map(([id]) => id),
    }));
    for (const node of graph) {
      expect(
        wouldCreateCycle(node.outputIngredientId, node.inputIngredientIds, graph),
      ).toBe(false);
    }
  });
});
