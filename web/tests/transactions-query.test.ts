import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getTransactionsForPeriod,
  getActiveCategories,
  getActiveAccounts,
  createTransaction,
  updateTransaction,
} from "../src/lib/transactions-query";

describe("getTransactionsForPeriod", () => {
  it("returns only the given month's transactions, most recent first, with joined names and dollar amounts", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 100000,
        direction: "outflow",
        status: "finalized",
        categoryId: category.id,
        accountId: account.id,
        description: "OK Supaa",
        notes: "receipt kept",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 5)),
        amountCents: 50000,
        direction: "inflow",
        status: "pending",
        categoryId: category.id,
        accountId: account.id,
        description: "Refund",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 6, 15)),
        amountCents: 20000,
        direction: "outflow",
        status: "finalized",
        categoryId: category.id,
        accountId: account.id,
        description: "July purchase, out of range",
      },
    });

    const rows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      month: 8,
      direction: "inflow",
      categoryName: "Groceries",
      accountName: "Cash",
      currency: "JPY",
      description: "Refund",
      amount: 500,
      status: "pending",
      notes: null,
    });
    expect(rows[1]).toMatchObject({
      month: 8,
      direction: "outflow",
      categoryName: "Groceries",
      accountName: "Cash",
      currency: "JPY",
      description: "OK Supaa",
      amount: 1000,
      status: "finalized",
      notes: "receipt kept",
    });
  });

  it("returns an empty array when there are no transactions in that month", async () => {
    const rows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    expect(rows).toEqual([]);
  });

  it("sorts ascending when sort: 'asc' is given, descending by default", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 100000,
        direction: "outflow",
        categoryId: category.id,
        accountId: account.id,
        description: "Early",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 20)),
        amountCents: 200000,
        direction: "outflow",
        categoryId: category.id,
        accountId: account.id,
        description: "Late",
      },
    });

    const period = new Date(Date.UTC(2026, 7, 1));
    const descending = await getTransactionsForPeriod(period);
    const ascending = await getTransactionsForPeriod(period, { sort: "asc" });

    expect(descending.map((r) => r.description)).toEqual(["Late", "Early"]);
    expect(ascending.map((r) => r.description)).toEqual(["Early", "Late"]);
  });

  it("filters by category, account, and direction", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const card = await prisma.account.create({ data: { name: "Card", currency: "JPY" } });
    const groceries = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });
    const job = await prisma.category.create({ data: { name: "Job", type: "income" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 100000,
        direction: "outflow",
        categoryId: groceries.id,
        accountId: cash.id,
        description: "Groceries via cash",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 2)),
        amountCents: 200000,
        direction: "outflow",
        categoryId: groceries.id,
        accountId: card.id,
        description: "Groceries via card",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 3)),
        amountCents: 300000,
        direction: "inflow",
        categoryId: job.id,
        accountId: cash.id,
        description: "Salary via cash",
      },
    });

    const period = new Date(Date.UTC(2026, 7, 1));

    const byCategory = await getTransactionsForPeriod(period, { categoryId: groceries.id });
    expect(byCategory.map((r) => r.description).sort()).toEqual(["Groceries via card", "Groceries via cash"]);

    const byAccount = await getTransactionsForPeriod(period, { accountId: cash.id });
    expect(byAccount.map((r) => r.description).sort()).toEqual(["Groceries via cash", "Salary via cash"]);

    const byDirection = await getTransactionsForPeriod(period, { direction: "inflow" });
    expect(byDirection.map((r) => r.description)).toEqual(["Salary via cash"]);
  });
});

describe("getActiveCategories / getActiveAccounts", () => {
  it("returns only active categories and accounts, sorted by name", async () => {
    await prisma.category.create({ data: { name: "Zebra", type: "expense" } });
    await prisma.category.create({ data: { name: "Apple", type: "expense" } });
    await prisma.category.create({ data: { name: "Inactive One", type: "expense", isActive: false } });
    await prisma.account.create({ data: { name: "Zcash", currency: "JPY" } });
    await prisma.account.create({ data: { name: "Acash", currency: "JPY" } });
    await prisma.account.create({ data: { name: "Old Account", currency: "JPY", isActive: false } });

    const categories = await getActiveCategories();
    const accounts = await getActiveAccounts();

    expect(categories.map((c) => c.name)).toEqual(["Apple", "Zebra"]);
    expect(accounts.map((a) => a.name)).toEqual(["Acash", "Zcash"]);
  });
});

describe("createTransaction", () => {
  it("inserts a new transaction converting dollars to cents", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await createTransaction({
      date: new Date(Date.UTC(2026, 7, 10)),
      direction: "outflow",
      categoryId: category.id,
      accountId: account.id,
      description: "Test purchase",
      amount: 1234.56,
      status: "finalized",
      notes: "note here",
    });

    const rows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Test purchase",
      amount: 1234.56,
      status: "finalized",
      notes: "note here",
    });
  });
});

describe("updateTransaction", () => {
  it("updates individual fields, converting dollars to cents for amount", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const card = await prisma.account.create({ data: { name: "Card", currency: "JPY" } });
    const groceries = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });
    const entertainment = await prisma.category.create({ data: { name: "Entertainment", type: "expense" } });

    await createTransaction({
      date: new Date(Date.UTC(2026, 7, 1)),
      direction: "outflow",
      categoryId: groceries.id,
      accountId: cash.id,
      description: "Original",
      amount: 100,
      status: "pending",
      notes: null,
    });

    const [before] = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));

    await updateTransaction(before.id, {
      description: "Updated",
      amount: 250.5,
      status: "finalized",
      categoryId: entertainment.id,
      accountId: card.id,
      direction: "inflow",
      notes: "edited via cell",
    });

    const [after] = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    expect(after).toMatchObject({
      description: "Updated",
      amount: 250.5,
      status: "finalized",
      categoryName: "Entertainment",
      accountName: "Card",
      direction: "inflow",
      notes: "edited via cell",
    });
  });

  it("updates the date, moving the transaction to a different period", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await createTransaction({
      date: new Date(Date.UTC(2026, 7, 1)),
      direction: "outflow",
      categoryId: category.id,
      accountId: account.id,
      description: "Move me",
      amount: 50,
      status: "finalized",
      notes: null,
    });

    const [before] = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    await updateTransaction(before.id, { date: new Date(Date.UTC(2026, 6, 15)) });

    const august = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    const july = await getTransactionsForPeriod(new Date(Date.UTC(2026, 6, 1)));
    expect(august).toEqual([]);
    expect(july).toHaveLength(1);
    expect(july[0].description).toBe("Move me");
  });
});
