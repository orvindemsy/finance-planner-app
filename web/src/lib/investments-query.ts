import { prisma } from "./prisma";

const CENTS = 100;

export type HoldingRow = {
  id: number;
  name: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  marketPrice: number;
  investedAmount: number;
  currentValue: number;
  pl: number;
  plPercent: number | null;
};

function toRow(h: {
  id: number;
  name: string;
  currency: string;
  quantity: number;
  avgPriceCents: number;
  marketPriceCents: number;
  unitScale: number;
}): HoldingRow {
  const avgPrice = h.avgPriceCents / CENTS;
  const marketPrice = h.marketPriceCents / CENTS;
  const investedAmount = (h.quantity * avgPrice) / h.unitScale;
  const currentValue = (h.quantity * marketPrice) / h.unitScale;
  const pl = currentValue - investedAmount;
  const plPercent = investedAmount !== 0 ? (pl / investedAmount) * 100 : null;
  return {
    id: h.id,
    name: h.name,
    currency: h.currency,
    quantity: h.quantity,
    avgPrice,
    marketPrice,
    investedAmount,
    currentValue,
    pl,
    plPercent,
  };
}

export async function getHoldings(currency: string): Promise<HoldingRow[]> {
  const holdings = await prisma.holding.findMany({
    where: { isActive: true, currency },
    orderBy: { name: "asc" },
  });
  return holdings.map(toRow);
}

export type PortfolioSummary = {
  investedAmount: number;
  currentValue: number;
  pl: number;
  plPercent: number | null;
};

export function summarizePortfolio(holdings: HoldingRow[]): PortfolioSummary {
  const investedAmount = holdings.reduce((sum, h) => sum + h.investedAmount, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const pl = currentValue - investedAmount;
  const plPercent = investedAmount !== 0 ? (pl / investedAmount) * 100 : null;
  return { investedAmount, currentValue, pl, plPercent };
}

// Creates a blank placeholder holding (0 quantity/prices) for the given
// currency, appended to the table below for editing cell-by-cell — same
// inline-creation pattern as "+ Add Transaction".
export async function addBlankHolding(currency: string): Promise<void> {
  // JP mutual funds quote price per 10,000 units (the Prisma default); IDR
  // holdings are ordinary per-share stocks/funds, so they default to 1.
  const unitScale = currency === "IDR" ? 1 : 10000;
  await prisma.holding.create({
    data: {
      name: "",
      currency,
      quantity: 0,
      avgPriceCents: 0,
      marketPriceCents: 0,
      unitScale,
    },
  });
}

export type HoldingFieldUpdate = {
  name?: string;
  quantity?: number;
  avgPrice?: number;
  marketPrice?: number;
};

export async function updateHolding(id: number, update: HoldingFieldUpdate): Promise<void> {
  const { avgPrice, marketPrice, ...rest } = update;
  await prisma.holding.update({
    where: { id },
    data: {
      ...rest,
      ...(avgPrice !== undefined ? { avgPriceCents: Math.round(avgPrice * CENTS) } : {}),
      ...(marketPrice !== undefined ? { marketPriceCents: Math.round(marketPrice * CENTS) } : {}),
    },
  });
}

export async function deleteHolding(id: number): Promise<void> {
  await prisma.holding.delete({ where: { id } });
}
