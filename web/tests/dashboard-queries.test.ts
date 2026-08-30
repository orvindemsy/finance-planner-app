import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getBalancesByCurrency,
  getAvailableMonths,
  getEffectivePlannedByCategory,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
} from "../src/lib/dashboard-queries";

async function seed() {
  const jpyAccount = await prisma.account.create({ data: { name: "JPY Wallet", currency: "JPY" } });
  const idrAccount = await prisma.account.create({ data: { name: "IDR Wallet", currency: "IDR" } });
  const salary = await prisma.category.create({ data: { name: "Salary", type: "income" } });
  const groceries = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

  await prisma.transaction.create({
    data: { date: new Date(2026, 2, 5), amountCents: 30000000, direction: "inflow", categoryId: salary.id, accountId: jpyAccount.id },
  });
  await prisma.transaction.create({
    data: { date: new Date(2026, 2, 10), amountCents: 500000, direction: "outflow", categoryId: groceries.id, accountId: jpyAccount.id },
  });
  await prisma.transaction.create({
    data: { date: new Date(2026, 1, 1), amountCents: 200000000, direction: "inflow", categoryId: salary.id, accountId: idrAccount.id },
  });

  await prisma.budgetDefault.create({ data: { categoryId: groceries.id, currency: "JPY", plannedAmountCents: 600000 } });

  return { jpyAccount, idrAccount, salary, groceries };
}

describe("getBalancesByCurrency", () => {
  it("sums signed amounts per account currency across all time", async () => {
    await seed();
    const balances = await getBalancesByCurrency();
    expect(balances.JPY).toBeCloseTo(300000 - 5000, 5); // 3,000.00 - 50.00
    expect(balances.IDR).toBeCloseTo(2000000, 5);
  });
});

describe("getAvailableMonths", () => {
  it("returns sorted YYYY-MM strings spanning the JPY transaction range", async () => {
    await seed();
    const months = await getAvailableMonths("JPY");
    expect(months).toEqual(["2026-03"]);
  });
});

describe("getEffectivePlannedByCategory", () => {
  it("falls back to BudgetDefault when no period-specific Budget exists", async () => {
    const { groceries } = await seed();
    const planned = await getEffectivePlannedByCategory(new Date(2026, 2, 1), "JPY");
    expect(planned[groceries.id]).toBeCloseTo(6000, 5); // 60.00
  });

  it("prefers a period-specific Budget over the default", async () => {
    const { groceries } = await seed();
    await prisma.budget.create({
      data: { categoryId: groceries.id, period: new Date(2026, 2, 1), currency: "JPY", plannedAmountCents: 700000 },
    });
    const planned = await getEffectivePlannedByCategory(new Date(2026, 2, 1), "JPY");
    expect(planned[groceries.id]).toBeCloseTo(7000, 5);
  });
});

describe("getCategoryBreakdown", () => {
  it("splits actual/budget by category type for the given period", async () => {
    await seed();
    const { expense, income } = await getCategoryBreakdown(new Date(2026, 2, 1), "JPY");
    expect(expense).toEqual([{ name: "Groceries", actual: 5000, budget: 6000 }]);
    expect(income).toEqual([{ name: "Salary", actual: 300000, budget: 0 }]);
  });
});

describe("getPeriodTotals", () => {
  it("returns income and expense totals for the given period only", async () => {
    await seed();
    const totals = await getPeriodTotals(new Date(2026, 2, 1), "JPY");
    expect(totals.income).toBeCloseTo(300000, 5);
    expect(totals.expense).toBeCloseTo(5000, 5);
  });
});

describe("getRecentTransactions", () => {
  it("returns transactions for the given currency, most recent first", async () => {
    await seed();
    const recent = await getRecentTransactions("JPY", 10);
    expect(recent).toHaveLength(2);
    expect(recent[0].categoryName).toBe("Groceries"); // 2026-03-10, most recent
    expect(recent[1].categoryName).toBe("Salary"); // 2026-03-05
  });
});
