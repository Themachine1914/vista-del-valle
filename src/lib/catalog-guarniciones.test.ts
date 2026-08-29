import { describe, expect, it } from "vitest";
import { dishes, recipes } from "../../prisma/catalog";

describe("garnish recipes", () => {
  it("gives every garnish a recipe so a sale deducts inventory", () => {
    const garnishIds = dishes
      .filter((d) => d.categoryId === "guarniciones")
      .map((d) => d.id);
    const withRecipe = new Set(recipes.map((r) => r.dishId));
    expect(garnishIds.filter((id) => !withRecipe.has(id))).toEqual([]);
  });
});
