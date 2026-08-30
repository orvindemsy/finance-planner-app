import { prisma } from "./prisma";
import { periodBounds, shiftPeriod } from "./period";

const CENTS = 100;

function actualForType(type: string, netCents: number): number {
  const result = type === "income" ? netCents : -netCents;
  return result || 0; // normalize -0 to 0
}

export async function getBalancesByCurrency(): Promise<Record<string, number>> {
  const accounts = await prisma.account.findMany({ include: { transactions: true } });
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    const netCents = account.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    totals[account.currency] = (totals[account.currency] ?? 0) + netCents / CENTS;
  }
  return totals;
}

export async function getAvailableMonths(currency: string): Promise<string[]> {
  const bounds = await prisma.transaction.aggregate({
    where: { account: { currency } },
    _min: { date: true },
    _max: { date: true },
  });

  const now = new Date();
  const first = bounds._min.date ?? now;
  const last = bounds._max.date ?? now;

  const months: string[] = [];
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor = shiftPeriod(cursor, 1);
  }
  return months;
}

export async function getEffectivePlannedByCategory(
  period: Date,
  currency: string
): Promise<Record<number, number>> {
  const defaults = await prisma.budgetDefault.findMany({ where: { currency } });
  const planned: Record<number, number> = {};
  for (const d of defaults) planned[d.categoryId] = d.plannedAmountCents / CENTS;

  const overrides = await prisma.budget.findMany({ where: { period, currency } });
  for (const b of overrides) planned[b.categoryId] = b.plannedAmountCents / CENTS;

  return planned;
}

export type BreakdownRow = { name: string; actual: number; budget: number };

export async function getCategoryBreakdown(
  period: Date,
  currency: string
): Promise<{ expense: BreakdownRow[]; income: BreakdownRow[] }> {
  const { start, end } = periodBounds(period);
  const planned = await getEffectivePlannedByCategory(period, currency);

  const categories = await prisma.category.findMany({
    where: { isActive: true, type: { in: ["income", "expense"] } },
    include: {
      transactions: {
        where: { date: { gte: start, lte: end }, account: { currency } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = categories.map((c) => {
    const netCents = c.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    return {
      name: c.name,
      type: c.type,
      actual: actualForType(c.type, netCents / CENTS),
      budget: planned[c.id] ?? 0,
    };
  });

  return {
    expense: rows.filter((r) => r.type === "expense").map(({ name, actual, budget }) => ({ name, actual, budget })),
    income: rows.filter((r) => r.type === "income").map(({ name, actual, budget }) => ({ name, actual, budget })),
  };
}

export async function getPeriodTotals(period: Date, currency: string): Promise<{ income: number; expense: number }> {
  const { start, end } = periodBounds(period);

  async function totalFor(type: string): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lte: end },
        account: { currency },
        category: { type },
      },
    });
    const netCents = transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    return actualForType(type, netCents / CENTS);
  }

  return { income: await totalFor("income"), expense: await totalFor("expense") };
}

export type TransactionRow = {
  date: Date;
  categoryName: string;
  accountName: string;
  amount: number;
  direction: "inflow" | "outflow";
  description: string | null;
};

export async function getRecentTransactions(currency: string, limit = 10): Promise<TransactionRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { account: { currency } },
    include: { category: true, account: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: limit,
  });

  return transactions.map((t) => ({
    date: t.date,
    categoryName: t.category.name,
    accountName: t.account.name,
    amount: t.amountCents / CENTS,
    direction: t.direction as "inflow" | "outflow",
    description: t.description,
  }));
}
