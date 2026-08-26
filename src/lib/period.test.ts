import { describe, expect, it } from "vitest";
import { parsePeriodo } from "./period";

describe("parsePeriodo", () => {
  it("uses a single UTC day for dia", () => {
    const p = parsePeriodo({ periodo: "dia", fecha: "2026-08-26" }, "2026-08-26");
    expect(p.label).toBe("26 agosto 2026");
    expect(p.gte.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(p.lt.toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("covers the whole month", () => {
    const p = parsePeriodo({ periodo: "mes", mes: "2026-02" }, "2026-08-26");
    expect(p.desde).toBe("2026-02-01");
    expect(p.hasta).toBe("2026-02-28");
    expect(p.lt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(p.label).toBe("febrero 2026");
  });

  it("covers the whole year", () => {
    const p = parsePeriodo({ periodo: "anio", anio: "2025" }, "2026-08-26");
    expect(p.desde).toBe("2025-01-01");
    expect(p.hasta).toBe("2025-12-31");
    expect(p.label).toBe("2025");
  });

  it("keeps a custom range inclusive", () => {
    const p = parsePeriodo(
      { periodo: "rango", desde: "2026-08-01", hasta: "2026-08-10" },
      "2026-08-26",
    );
    expect(p.gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(p.lt.toISOString()).toBe("2026-08-11T00:00:00.000Z");
  });
});
