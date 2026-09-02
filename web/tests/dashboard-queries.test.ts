import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getBalancesByCurrency,
  getAvailableMonths,
  getEffectivePlannedByCategory,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
  setBudgetForCategory,
} from "../src/lib/dashboard-queries";

// All dates here are seeded with Date.UTC(...) to match how the real
// migration script stores dates (`new Date("YYYY-MM-DD")`, which is UTC
// midnight) — see period.ts for why local-timezone Date construction would
// silently skew results on non-UTC machines.
async function seed() {
  const jpyAccount = await prisma.account.create({ data: { name: "JPY Wallet", currency: "JPY" } });
  const idrAccount = await prisma.account.create({ data: { name: "IDR Wallet", currency: "IDR" } });
  const salary = await prisma.category.create({ data: { name: "Salary", type: "income" } });
  const groceries = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

  await prisma.transaction.create({
    data: { date: new Date(Date.UTC(2026, 2, 5)), amountCents: 30000000, direction: "inflow", categoryId: salary.id, accountId: jpyAccount.id },
  });
  await prisma.transaction.create({
    data: { date: new Date(Date.UTC(2026, 2, 10)), amountCents: 500000, direction: "outflow", categoryId: groceries.id, accountId: jpyAccount.id },
  });
  await prisma.transaction.create({
    data: { date: new Date(Date.UTC(2026, 1, 1)), amountCents: 200000000, direction: "inflow", categoryId: salary.id, accountId: idrAccount.id },
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

  it("includes non-income/expense category types (e.g. savings/transfer) in the balance", async () => {
    const { jpyAccount } = await seed();
    const savings = await prisma.category.create({ data: { name: "Savings Transfer", type: "savings" } });
    // An outflow against a "savings" category — not income or expense — must
    // still affect the balance, since balances are a straight sum across all
    // transactions on the account, not an income-minus-expense proxy.
    await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 2, 15)), amountCents: 100000, direction: "outflow", categoryId: savings.id, accountId: jpyAccount.id },
    });

    const balances = await getBalancesByCurrency();
    // Baseline JPY balance (295000) minus the 1000 savings outflow.
    expect(balances.JPY).toBeCloseTo(300000 - 5000 - 1000, 5);
  });

  it("adds each account's starting balance on top of its transaction total", async () => {
    await seed();
    await prisma.account.update({
      where: { name: "JPY Wallet" },
      data: { startingBalanceCents: 100_000_00 },
    });
    await prisma.account.update({
      where: { name: "IDR Wallet" },
      data: { startingBalanceCents: 5_000_000_00 },
    });

    const balances = await getBalancesByCurrency();
    expect(balances.JPY).toBeCloseTo(100000 + 300000 - 5000, 5);
    expect(balances.IDR).toBeCloseTo(5000000 + 2000000, 5);
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
    const planned = await getEffectivePlannedByCategory(new Date(Date.UTC(2026, 2, 1)), "JPY");
    expect(planned[groceries.id]).toBeCloseTo(6000, 5); // 60.00
  });

  it("prefers a period-specific Budget over the default", async () => {
    const { groceries } = await seed();
    await prisma.budget.create({
      data: { categoryId: groceries.id, period: new Date(Date.UTC(2026, 2, 1)), currency: "JPY", plannedAmountCents: 700000 },
    });
    const planned = await getEffectivePlannedByCategory(new Date(Date.UTC(2026, 2, 1)), "JPY");
    expect(planned[groceries.id]).toBeCloseTo(7000, 5);
  });
});

describe("getCategoryBreakdown", () => {
  it("splits actual/budget by category type for the given period", async () => {
    const { groceries, salary } = await seed();
    const { expense, income } = await getCategoryBreakdown(new Date(Date.UTC(2026, 2, 1)), "JPY");
    expect(expense).toEqual([{ categoryId: groceries.id, name: "Groceries", actual: 5000, budget: 6000 }]);
    expect(income).toEqual([{ categoryId: salary.id, name: "Salary", actual: 300000, budget: 0 }]);
  });

  it("includes a transaction dated on the last day of the month (UTC boundary)", async () => {
    const { jpyAccount, groceries } = await seed();
    // The last instant of March (23:59:59.999 UTC on the 31st) must fall
    // within March's bounds, not be excluded or bleed into April.
    await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 2, 31)), amountCents: 123400, direction: "outflow", categoryId: groceries.id, accountId: jpyAccount.id },
    });

    const { expense } = await getCategoryBreakdown(new Date(Date.UTC(2026, 2, 1)), "JPY");
    // Baseline Groceries actual (5000) plus the new last-day transaction (1234).
    expect(expense).toEqual([{ categoryId: groceries.id, name: "Groceries", actual: 5000 + 1234, budget: 6000 }]);

    // And it must NOT appear in April's breakdown (April has no transactions;
    // the BudgetDefault of 6000 still applies since it's period-independent).
    const april = await getCategoryBreakdown(new Date(Date.UTC(2026, 3, 1)), "JPY");
    expect(april.expense).toEqual([{ categoryId: groceries.id, name: "Groceries", actual: 0, budget: 6000 }]);
  });
});

describe("getPeriodTotals", () => {
  it("returns income and expense totals for the given period only", async () => {
    await seed();
    const totals = await getPeriodTotals(new Date(Date.UTC(2026, 2, 1)), "JPY");
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

describe("setBudgetForCategory", () => {
  it("creates a period-specific Budget row when none exists yet", async () => {
    const { groceries } = await seed();
    const period = new Date(Date.UTC(2026, 2, 1));

    await setBudgetForCategory(groceries.id, period, "JPY", 7000);

    const planned = await getEffectivePlannedByCategory(period, "JPY");
    expect(planned[groceries.id]).toBeCloseTo(7000, 5);
  });

  it("updates the existing Budget row for that category/period/currency instead of duplicating it", async () => {
    const { groceries } = await seed();
    const period = new Date(Date.UTC(2026, 2, 1));

    await setBudgetForCategory(groceries.id, period, "JPY", 7000);
    await setBudgetForCategory(groceries.id, period, "JPY", 8500);

    const planned = await getEffectivePlannedByCategory(period, "JPY");
    expect(planned[groceries.id]).toBeCloseTo(8500, 5);

    const rows = await prisma.budget.findMany({ where: { categoryId: groceries.id, currency: "JPY" } });
    expect(rows).toHaveLength(1);
  });

  it("only affects the given period, leaving other months' effective budget (the BudgetDefault) alone", async () => {
    const { groceries } = await seed();
    const march = new Date(Date.UTC(2026, 2, 1));
    const april = new Date(Date.UTC(2026, 3, 1));

    await setBudgetForCategory(groceries.id, march, "JPY", 9000);

    const marchPlanned = await getEffectivePlannedByCategory(march, "JPY");
    const aprilPlanned = await getEffectivePlannedByCategory(april, "JPY");
    expect(marchPlanned[groceries.id]).toBeCloseTo(9000, 5);
    expect(aprilPlanned[groceries.id]).toBeCloseTo(6000, 5); // seed()'s BudgetDefault, untouched
  });
});
