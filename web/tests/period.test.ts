import { describe, it, expect } from "vitest";
import { parsePeriod, periodBounds, shiftPeriod } from "../src/lib/period";

describe("parsePeriod", () => {
  it("parses a YYYY-MM string to the first of that month", () => {
    const result = parsePeriod("2026-03");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // 0-indexed
    expect(result.getDate()).toBe(1);
  });

  it("falls back to the current month on null", () => {
    const now = new Date();
    const result = parsePeriod(null);
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
  });

  it("falls back to the current month on malformed input", () => {
    const now = new Date();
    const result = parsePeriod("not-a-period");
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
  });
});

describe("periodBounds", () => {
  it("returns first and last day of a 31-day month", () => {
    const { start, end } = periodBounds(new Date(2026, 0, 1)); // Jan 2026
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
  });

  it("handles February in a leap year", () => {
    const { end } = periodBounds(new Date(2028, 1, 1)); // Feb 2028 (leap)
    expect(end.getDate()).toBe(29);
  });
});

describe("shiftPeriod", () => {
  it("shifts forward within the same year", () => {
    const result = shiftPeriod(new Date(2026, 2, 1), 1); // Mar -> Apr 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
  });

  it("rolls over to the next year", () => {
    const result = shiftPeriod(new Date(2026, 11, 1), 1); // Dec 2026 -> Jan 2027
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });

  it("rolls back to the previous year", () => {
    const result = shiftPeriod(new Date(2026, 0, 1), -1); // Jan 2026 -> Dec 2025
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
  });
});
