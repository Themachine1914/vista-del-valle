import { describe, expect, it } from "vitest";
import { categories, dishes } from "../../prisma/catalog";

const byId = Object.fromEntries(dishes.map((d) => [d.id, d]));

describe("menú impreso Vista del Valle", () => {
  it("keeps unique dish ids after adding wines and tragos", () => {
    const ids = dishes.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prices food from the printed carta", () => {
    expect(byId["chivo-del-valle"]?.precio).toBe(960);
    expect(byId.ribeye?.precio).toBe(2295);
    expect(byId["tabla-mixta"]?.precio).toBe(2995);
    expect(byId["pasta-marinera"]?.precio).toBe(1195);
    expect(byId.sancocho?.precio).toBe(795);
    expect(byId["dulce-coco"]?.precio).toBe(280);
  });

  it("prices the printed wine list", () => {
    expect(byId["nabal-reserva"]?.precio).toBe(5800);
    expect(byId["bernard-remy"]?.precio).toBe(4400);
    expect(byId["six-eight-nine"]?.precio).toBe(2150);
    expect(byId["goru"]?.precio).toBe(1195);
    expect(byId["ilauri-prosecco"]?.precio).toBe(1895);
    expect(byId["beringer-pinot"]?.precio).toBe(1100);
  });

  it("prices the printed tragos list", () => {
    expect(byId["barcelo-gran-anejo"]?.precio).toBe(200);
    expect(byId["macallan-12"]?.precio).toBe(855);
    expect(byId["remy-martin-vsop"]?.precio).toBe(725);
    expect(byId["patron-silver"]?.precio).toBe(630);
    expect(byId.cointreau?.precio).toBe(395);
    expect(byId.ginebra?.nombre).toBe("Beefeater");
    expect(byId.ginebra?.precio).toBe(285);
  });

  it("keeps kitchen sauces off the public menu", () => {
    const salsas = categories.find((c) => c.id === "salsas");
    expect(salsas?.esInterna).toBe(true);
    for (const id of [
      "salsa-de-tamarindo",
      "salsa-del-bosque",
      "salsa-al-ajillo",
      "salsa-pomodoro",
      "salsa-alfredo-blanca",
      "salsa-romero",
      "salsa-del-rey",
      "salsa-blue-cheese",
    ]) {
      expect(byId[id]?.categoryId).toBe("salsas");
      expect(byId[id]?.precio ?? null).toBeNull();
    }
  });
});
