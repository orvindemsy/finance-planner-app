import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getHoldings,
  summarizePortfolio,
  addBlankHolding,
  updateHolding,
  deleteHolding,
} from "../src/lib/investments-query";

describe("getHoldings", () => {
  it("computes invested amount, current value, and P/L from quantity and per-unitScale prices", async () => {
    // Mirrors a real Japanese mutual fund: price quoted per 10,000 units.
    await prisma.holding.create({
      data: {
        name: "eMAXIS Slim 米国株式(S&P500)",
        currency: "JPY",
        quantity: 49242,
        avgPriceCents: 2944700, // ¥29,447 per 10,000 units
        marketPriceCents: 4540800, // ¥45,408 per 10,000 units
        unitScale: 10000,
      },
    });

    const [row] = await getHoldings("JPY");

    expect(row.investedAmount).toBeCloseTo((49242 * 29447) / 10000, 1);
    expect(row.currentValue).toBeCloseTo((49242 * 45408) / 10000, 1);
    expect(row.pl).toBeCloseTo(row.currentValue - row.investedAmount, 1);
    expect(row.plPercent).toBeCloseTo((row.pl / row.investedAmount) * 100, 2);
  });

  it("only returns active holdings for the given currency, sorted by name", async () => {
    await prisma.holding.create({
      data: { name: "Zebra Fund", currency: "JPY", quantity: 1, avgPriceCents: 100, marketPriceCents: 100 },
    });
    await prisma.holding.create({
      data: { name: "Apple Fund", currency: "JPY", quantity: 1, avgPriceCents: 100, marketPriceCents: 100 },
    });
    await prisma.holding.create({
      data: { name: "IDR Fund", currency: "IDR", quantity: 1, avgPriceCents: 100, marketPriceCents: 100 },
    });
    await prisma.holding.create({
      data: {
        name: "Inactive Fund",
        currency: "JPY",
        quantity: 1,
        avgPriceCents: 100,
        marketPriceCents: 100,
        isActive: false,
      },
    });

    const jpy = await getHoldings("JPY");
    expect(jpy.map((h) => h.name)).toEqual(["Apple Fund", "Zebra Fund"]);
  });

  it("returns null P/L% when invested amount is zero, instead of dividing by zero", async () => {
    await prisma.holding.create({
      data: { name: "Blank", currency: "JPY", quantity: 0, avgPriceCents: 0, marketPriceCents: 0 },
    });

    const [row] = await getHoldings("JPY");
    expect(row.investedAmount).toBe(0);
    expect(row.plPercent).toBeNull();
  });
});

describe("summarizePortfolio", () => {
  it("aggregates invested amount, current value, and P/L across holdings", async () => {
    await prisma.holding.create({
      data: { name: "Fund A", currency: "JPY", quantity: 10000, avgPriceCents: 1000000, marketPriceCents: 1200000 },
    });
    await prisma.holding.create({
      data: { name: "Fund B", currency: "JPY", quantity: 10000, avgPriceCents: 500000, marketPriceCents: 400000 },
    });

    const holdings = await getHoldings("JPY");
    const summary = summarizePortfolio(holdings);

    expect(summary.investedAmount).toBeCloseTo(10000 + 5000, 1);
    expect(summary.currentValue).toBeCloseTo(12000 + 4000, 1);
    expect(summary.pl).toBeCloseTo(summary.currentValue - summary.investedAmount, 1);
  });
});

describe("addBlankHolding / updateHolding / deleteHolding", () => {
  it("creates a zeroed placeholder holding for the given currency", async () => {
    await addBlankHolding("JPY");
    const [row] = await getHoldings("JPY");
    expect(row).toMatchObject({ name: "", currency: "JPY", quantity: 0, avgPrice: 0, marketPrice: 0 });
  });

  it("updates individual fields, converting dollars to cents for prices", async () => {
    const holding = await prisma.holding.create({
      data: { name: "Old Name", currency: "JPY", quantity: 1, avgPriceCents: 100, marketPriceCents: 100 },
    });

    await updateHolding(holding.id, { name: "New Name", quantity: 500, avgPrice: 1234.56, marketPrice: 2000 });

    const [row] = await getHoldings("JPY");
    expect(row).toMatchObject({ name: "New Name", quantity: 500, avgPrice: 1234.56, marketPrice: 2000 });
  });

  it("removes the holding entirely", async () => {
    const holding = await prisma.holding.create({
      data: { name: "To Delete", currency: "JPY", quantity: 1, avgPriceCents: 100, marketPriceCents: 100 },
    });

    await deleteHolding(holding.id);

    const rows = await getHoldings("JPY");
    expect(rows).toEqual([]);
  });
});
