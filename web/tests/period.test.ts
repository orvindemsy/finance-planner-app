import { describe, it, expect } from "vitest";
import { parsePeriod, periodBounds, shiftPeriod } from "../src/lib/period";

describe("parsePeriod", () => {
  it("parses a YYYY-MM string to the first of that month (UTC)", () => {
    const result = parsePeriod("2026-03");
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(2); // 0-indexed
    expect(result.getUTCDate()).toBe(1);
  });

  it("falls back to the current month on null", () => {
    const now = new Date();
    const result = parsePeriod(null);
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
  });

  it("falls back to the current month on malformed input", () => {
    const now = new Date();
    const result = parsePeriod("not-a-period");
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
  });
});

describe("periodBounds", () => {
  it("returns first and last day of a 31-day month (UTC)", () => {
    const { start, end } = periodBounds(new Date(Date.UTC(2026, 0, 1))); // Jan 2026
    expect(start.getUTCDate()).toBe(1);
    expect(end.getUTCDate()).toBe(31);
  });

  it("handles February in a leap year", () => {
    const { end } = periodBounds(new Date(Date.UTC(2028, 1, 1))); // Feb 2028 (leap)
    expect(end.getUTCDate()).toBe(29);
  });

  it("includes the last instant of the last day", () => {
    const { end } = periodBounds(new Date(Date.UTC(2026, 0, 1))); // Jan 2026
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
    expect(end.getUTCMilliseconds()).toBe(999);
  });
});

describe("shiftPeriod", () => {
  it("shifts forward within the same year", () => {
    const result = shiftPeriod(new Date(Date.UTC(2026, 2, 1)), 1); // Mar -> Apr 2026
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(3);
  });

  it("rolls over to the next year", () => {
    const result = shiftPeriod(new Date(Date.UTC(2026, 11, 1)), 1); // Dec 2026 -> Jan 2027
    expect(result.getUTCFullYear()).toBe(2027);
    expect(result.getUTCMonth()).toBe(0);
  });

  it("rolls back to the previous year", () => {
    const result = shiftPeriod(new Date(Date.UTC(2026, 0, 1)), -1); // Jan 2026 -> Dec 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11);
  });
});
