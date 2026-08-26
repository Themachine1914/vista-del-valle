import { describe, expect, it } from "vitest";
import { toMoney, formatRD, formatQty, formatStockCompra, GRAMS_PER_LB } from "./money";

describe("toMoney", () => {
  it("returns 0 for null and undefined", () => {
    expect(toMoney(null)).toBe(0);
    expect(toMoney(undefined)).toBe(0);
  });

  it("passes through numbers as-is", () => {
    expect(toMoney(790)).toBe(790);
  });

  it("converts numeric strings", () => {
    expect(toMoney("960.5")).toBe(960.5);
  });
});

describe("formatRD", () => {
  it("formats a value as DOP currency with no decimals", () => {
    expect(formatRD(790)).toBe("RD$790");
  });

  it("formats null as RD$0", () => {
    expect(formatRD(null)).toBe("RD$0");
  });
});

describe("formatQty", () => {
  it("formats units (UD) as-is", () => {
    expect(formatQty(12, "UD")).toBe("12 ud");
  });

  it("keeps grams below 1000", () => {
    expect(formatQty(500, "G")).toBe("500 g");
  });

  it("converts grams to kg at the 1000 boundary", () => {
    expect(formatQty(1000, "G")).toBe("1 kg");
    expect(formatQty(1500, "G")).toBe("1.5 kg");
  });

  it("keeps milliliters below 1000", () => {
    expect(formatQty(750, "ML")).toBe("750 ml");
  });

  it("converts milliliters to liters at the 1000 boundary", () => {
    expect(formatQty(2000, "ML")).toBe("2 L");
  });
});

describe("formatStockCompra", () => {
  it("shows pound stock for gram products", () => {
    expect(formatStockCompra(50 * GRAMS_PER_LB, "G")).toMatch(/50/);
    expect(formatStockCompra(50 * GRAMS_PER_LB, "G")).toMatch(/lb/);
  });

  it("shows liters for milliliter products", () => {
    expect(formatStockCompra(1500, "ML")).toBe("1.5 L");
  });

  it("shows units as-is", () => {
    expect(formatStockCompra(24, "UD")).toMatch(/24/);
    expect(formatStockCompra(24, "UD")).toMatch(/ud/);
  });
});
