import { prisma } from "./prisma";
import { periodBounds, shiftPeriod } from "./period";

const CENTS = 100;

function actualForType(type: string, netCents: number): number {
  const result = type === "income" ? netCents : -netCents;
  return result || 0; // normalize -0 to 0
}

// Balance as of the end of the given period (inclusive) — matches what the
// Transactions page's Running Balance column shows for an account's last
// transaction on or before that month, not today's all-time total. Selecting
// an earlier month on the Dashboard should show what the account actually
// held back then, not its current balance.
export async function getBalancesByCurrency(period: Date): Promise<Record<string, number>> {
  const { end } = periodBounds(period);
  const accounts = await prisma.account.findMany({
    include: { transactions: { where: { status: "finalized", date: { lte: end } } } },
  });
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    const netCents = account.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    const accountCents = account.startingBalanceCents + netCents;
    totals[account.currency] = (totals[account.currency] ?? 0) + accountCents / CENTS;
  }
  return totals;
}

export type AccountBalanceRow = { id: number; name: string; balance: number };

// Per-account breakdown of the balance figure `getBalancesByCurrency` sums for
// this currency — same finalized-only, as-of-period logic, but split out per
// account so the Dashboard can show what makes up the aggregate total.
export async function getAccountBalancesByCurrency(period: Date, currency: string): Promise<AccountBalanceRow[]> {
  const { end } = periodBounds(period);
  const accounts = await prisma.account.findMany({
    where: { isActive: true, currency },
    include: { transactions: { where: { status: "finalized", date: { lte: end } } } },
    orderBy: { name: "asc" },
  });
  return accounts.map((account) => {
    const netCents = account.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    return { id: account.id, name: account.name, balance: (account.startingBalanceCents + netCents) / CENTS };
  });
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

export type BreakdownRow = { categoryId: number; name: string; actual: number; budget: number };

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
        where: { date: { gte: start, lte: end }, account: { currency }, status: "finalized" },
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
      categoryId: c.id,
      name: c.name,
      type: c.type,
      actual: actualForType(c.type, netCents / CENTS),
      budget: planned[c.id] ?? 0,
    };
  });

  return {
    expense: rows
      .filter((r) => r.type === "expense")
      .map(({ categoryId, name, actual, budget }) => ({ categoryId, name, actual, budget })),
    income: rows
      .filter((r) => r.type === "income")
      .map(({ categoryId, name, actual, budget }) => ({ categoryId, name, actual, budget })),
  };
}

export async function setBudgetForCategory(
  categoryId: number,
  period: Date,
  currency: string,
  amount: number
): Promise<void> {
  const plannedAmountCents = Math.round(amount * CENTS);
  await prisma.budget.upsert({
    where: { uq_budget_category_period_currency: { categoryId, period, currency } },
    update: { plannedAmountCents },
    create: { categoryId, period, currency, plannedAmountCents },
  });
}

export async function getPeriodTotals(period: Date, currency: string): Promise<{ income: number; expense: number }> {
  const { start, end } = periodBounds(period);

  async function totalFor(type: string): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lte: end },
        account: { currency },
        category: { type },
        status: "finalized",
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
