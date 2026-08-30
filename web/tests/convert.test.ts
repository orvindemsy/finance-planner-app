import { describe, it, expect } from "vitest";
import { convertAmount } from "../src/lib/convert";

describe("convertAmount", () => {
  const rates = { jpy: 150, idr: 15000 };

  it("returns the amount unchanged when from === to", () => {
    expect(convertAmount(1000, "JPY", "JPY", rates)).toBe(1000);
  });

  it("converts JPY to IDR via the USD cross-rate", () => {
    // 1000 JPY = 1000/150 USD = 6.666... USD = 6.666... * 15000 IDR
    const result = convertAmount(1000, "JPY", "IDR", rates);
    expect(result).toBeCloseTo((1000 / 150) * 15000, 2);
  });

  it("converts IDR to JPY via the USD cross-rate", () => {
    const result = convertAmount(150000, "IDR", "JPY", rates);
    expect(result).toBeCloseTo((150000 / 15000) * 150, 2);
  });

  it("returns null when a required rate is missing", () => {
    expect(convertAmount(1000, "JPY", "IDR", { jpy: null, idr: 15000 })).toBeNull();
    expect(convertAmount(1000, "JPY", "IDR", { jpy: 150, idr: null })).toBeNull();
  });
});
