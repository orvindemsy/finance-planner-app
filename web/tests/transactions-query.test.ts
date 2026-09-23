import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getTransactionsForPeriod,
  getActiveCategories,
  getActiveAccounts,
  createTransaction,
  createTransfer,
  updateTransaction,
  deleteTransaction,
  getRunningBalances,
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

  it("sorts by amount instead of date when sortBy: 'amount' is given", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 20)),
        amountCents: 100000,
        direction: "outflow",
        categoryId: category.id,
        accountId: account.id,
        description: "Small but late",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 500000,
        direction: "outflow",
        categoryId: category.id,
        accountId: account.id,
        description: "Big but early",
      },
    });

    const period = new Date(Date.UTC(2026, 7, 1));
    const descending = await getTransactionsForPeriod(period, { sortBy: "amount" });
    const ascending = await getTransactionsForPeriod(period, { sortBy: "amount", sort: "asc" });

    expect(descending.map((r) => r.description)).toEqual(["Big but early", "Small but late"]);
    expect(ascending.map((r) => r.description)).toEqual(["Small but late", "Big but early"]);
  });

  it("filters by a case-insensitive keyword across description, notes, category, and account", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const groceries = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 100000,
        direction: "outflow",
        categoryId: groceries.id,
        accountId: cash.id,
        description: "OK Supaa run",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 2)),
        amountCents: 50000,
        direction: "outflow",
        categoryId: groceries.id,
        accountId: cash.id,
        description: "Coffee",
        notes: "with the OK crew",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 3)),
        amountCents: 20000,
        direction: "outflow",
        categoryId: groceries.id,
        accountId: cash.id,
        description: "Unrelated purchase",
      },
    });

    const period = new Date(Date.UTC(2026, 7, 1));
    const rows = await getTransactionsForPeriod(period, { search: "ok" });

    expect(rows.map((r) => r.description).sort()).toEqual(["Coffee", "OK Supaa run"]);
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

  it("filters by the account's currency, for the JPY/IDR transaction views", async () => {
    const period = new Date(Date.UTC(2026, 7, 1));
    const jpyAccount = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const idrAccount = await prisma.account.create({ data: { name: "BCA", currency: "IDR" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 100000,
        direction: "outflow",
        categoryId: category.id,
        accountId: jpyAccount.id,
        description: "Yen purchase",
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 200000,
        direction: "outflow",
        categoryId: category.id,
        accountId: idrAccount.id,
        description: "Rupiah purchase",
      },
    });

    const jpyRows = await getTransactionsForPeriod(period, { currency: "JPY" });
    const idrRows = await getTransactionsForPeriod(period, { currency: "IDR" });

    expect(jpyRows.map((r) => r.description)).toEqual(["Yen purchase"]);
    expect(idrRows.map((r) => r.description)).toEqual(["Rupiah purchase"]);
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

  it("filters accounts by currency when given", async () => {
    await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    await prisma.account.create({ data: { name: "BCA", currency: "IDR" } });

    const jpyAccounts = await getActiveAccounts("JPY");
    const idrAccounts = await getActiveAccounts("IDR");

    expect(jpyAccounts.map((a) => a.name)).toEqual(["Cash"]);
    expect(idrAccounts.map((a) => a.name)).toEqual(["BCA"]);
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

describe("createTransfer", () => {
  it("creates a linked outflow on the From account and inflow on the To account, both tagged Internal Transfer", async () => {
    const yucho = await prisma.account.create({ data: { name: "Yucho Transfer", currency: "JPY" } });
    const paypay = await prisma.account.create({ data: { name: "Paypay", currency: "JPY" } });
    await prisma.category.create({ data: { name: "Internal Transfer", type: "transfer" } });

    await createTransfer({
      date: new Date(Date.UTC(2026, 7, 15)),
      fromAccountId: yucho.id,
      toAccountId: paypay.id,
      amount: 10000,
      description: "Charge Paypay",
    });

    const yuchoRows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)), { accountId: yucho.id });
    const paypayRows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)), { accountId: paypay.id });

    expect(yuchoRows).toHaveLength(1);
    expect(yuchoRows[0]).toMatchObject({ direction: "outflow", amount: 10000, description: "Charge Paypay" });
    expect(paypayRows).toHaveLength(1);
    expect(paypayRows[0]).toMatchObject({ direction: "inflow", amount: 10000, description: "Charge Paypay" });

    // Both legs must be cross-referenced so the pairing is auditable later.
    const outflowNote = await prisma.transaction.findFirst({ where: { accountId: yucho.id } });
    const inflowNote = await prisma.transaction.findFirst({ where: { accountId: paypay.id } });
    expect(outflowNote?.notes).toContain(`#${inflowNote?.id}`);
    expect(inflowNote?.notes).toContain(`#${outflowNote?.id}`);
  });

  it("auto-generates a description referencing the other account when none is given", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const paypay = await prisma.account.create({ data: { name: "Paypay", currency: "JPY" } });
    await prisma.category.create({ data: { name: "Internal Transfer", type: "transfer" } });

    await createTransfer({
      date: new Date(Date.UTC(2026, 7, 15)),
      fromAccountId: cash.id,
      toAccountId: paypay.id,
      amount: 5000,
      description: null,
    });

    const cashRows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)), { accountId: cash.id });
    const paypayRows = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)), { accountId: paypay.id });
    expect(cashRows[0].description).toBe("Transfer to Paypay");
    expect(paypayRows[0].description).toBe("Transfer from Cash");
  });

  it("rejects a transfer where From and To are the same account", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    await prisma.category.create({ data: { name: "Internal Transfer", type: "transfer" } });

    await expect(
      createTransfer({
        date: new Date(Date.UTC(2026, 7, 15)),
        fromAccountId: cash.id,
        toAccountId: cash.id,
        amount: 1000,
        description: null,
      })
    ).rejects.toThrow("From and To accounts must be different");
  });

  it("rejects a transfer between accounts of different currencies", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const bca = await prisma.account.create({ data: { name: "BCA", currency: "IDR" } });
    await prisma.category.create({ data: { name: "Internal Transfer", type: "transfer" } });

    await expect(
      createTransfer({
        date: new Date(Date.UTC(2026, 7, 15)),
        fromAccountId: cash.id,
        toAccountId: bca.id,
        amount: 1000,
        description: null,
      })
    ).rejects.toThrow("From and To accounts must be the same currency");
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

describe("deleteTransaction", () => {
  it("removes the transaction so it no longer appears in its period", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await createTransaction({
      date: new Date(Date.UTC(2026, 7, 1)),
      direction: "outflow",
      categoryId: category.id,
      accountId: account.id,
      description: "Delete me",
      amount: 50,
      status: "finalized",
      notes: null,
    });

    const [before] = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    await deleteTransaction(before.id);

    const after = await getTransactionsForPeriod(new Date(Date.UTC(2026, 7, 1)));
    expect(after).toEqual([]);
  });
});

describe("getRunningBalances", () => {
  it("computes cumulative balance per transaction, starting from the account's starting balance", async () => {
    const account = await prisma.account.create({
      data: { name: "Yucho Transfer", currency: "JPY", startingBalanceCents: 100000 },
    });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    const t1 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 1)), amountCents: 30000, direction: "inflow", categoryId: category.id, accountId: account.id },
    });
    const t2 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 5)), amountCents: 5000, direction: "outflow", categoryId: category.id, accountId: account.id },
    });
    const t3 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 1, 1)), amountCents: 2000, direction: "outflow", categoryId: category.id, accountId: account.id },
    });

    const balances = await getRunningBalances([account.id]);

    expect(balances.get(t1.id)).toBeCloseTo(1300, 5); // 1000 + 300
    expect(balances.get(t2.id)).toBeCloseTo(1250, 5); // 1300 - 50
    expect(balances.get(t3.id)).toBeCloseTo(1230, 5); // 1250 - 20
  });

  it("carries the balance forward unchanged for pending transactions, without affecting later finalized ones", async () => {
    const account = await prisma.account.create({
      data: { name: "Yucho Transfer", currency: "JPY", startingBalanceCents: 100000 },
    });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    const finalized1 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 1)), amountCents: 30000, direction: "inflow", status: "finalized", categoryId: category.id, accountId: account.id },
    });
    const pending = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 2)), amountCents: 999900, direction: "inflow", status: "pending", categoryId: category.id, accountId: account.id },
    });
    const finalized2 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 3)), amountCents: 5000, direction: "outflow", status: "finalized", categoryId: category.id, accountId: account.id },
    });

    const balances = await getRunningBalances([account.id]);

    expect(balances.get(finalized1.id)).toBeCloseTo(1300, 5); // 1000 + 300
    // Pending: same balance as the row before it, not affected by its own amount.
    expect(balances.get(pending.id)).toBeCloseTo(1300, 5);
    // finalized2 continues from finalized1's running total, skipping the pending inflow entirely.
    expect(balances.get(finalized2.id)).toBeCloseTo(1250, 5); // 1300 - 50
  });

  it("keeps each account's running balance independent of the others", async () => {
    const a1 = await prisma.account.create({ data: { name: "Cash", currency: "JPY", startingBalanceCents: 0 } });
    const a2 = await prisma.account.create({ data: { name: "Paypay", currency: "JPY", startingBalanceCents: 50000 } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    const t1 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 1)), amountCents: 10000, direction: "inflow", categoryId: category.id, accountId: a1.id },
    });
    const t2 = await prisma.transaction.create({
      data: { date: new Date(Date.UTC(2026, 0, 1)), amountCents: 10000, direction: "outflow", categoryId: category.id, accountId: a2.id },
    });

    const balances = await getRunningBalances([a1.id, a2.id]);

    expect(balances.get(t1.id)).toBeCloseTo(100, 5); // Cash: 0 + 100
    expect(balances.get(t2.id)).toBeCloseTo(400, 5); // Paypay: 500 - 100
  });

  it("breaks same-date ties by transaction id, ascending", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });
    const sameDate = new Date(Date.UTC(2026, 0, 1));

    const first = await prisma.transaction.create({
      data: { date: sameDate, amountCents: 10000, direction: "inflow", categoryId: category.id, accountId: account.id },
    });
    const second = await prisma.transaction.create({
      data: { date: sameDate, amountCents: 3000, direction: "outflow", categoryId: category.id, accountId: account.id },
    });

    const balances = await getRunningBalances([account.id]);

    expect(balances.get(first.id)).toBeCloseTo(100, 5);
    expect(balances.get(second.id)).toBeCloseTo(70, 5);
  });

  it("returns an empty map for an empty account list", async () => {
    const balances = await getRunningBalances([]);
    expect(balances.size).toBe(0);
  });
});
