import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getAllAccounts,
  updateAccountStartingBalance,
  createAccount,
  deactivateAccount,
} from "../src/lib/accounts-query";

describe("getAllAccounts", () => {
  it("returns active accounts sorted by name, with starting and current balances in dollars", async () => {
    const cash = await prisma.account.create({ data: { name: "Cash", currency: "JPY", startingBalanceCents: 10000000 } });
    await prisma.account.create({ data: { name: "Old Account", currency: "JPY", isActive: false } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });

    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 50000,
        direction: "outflow",
        categoryId: category.id,
        accountId: cash.id,
      },
    });

    const accounts = await getAllAccounts();

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      name: "Cash",
      currency: "JPY",
      startingBalance: 100000,
      currentBalance: 100000 - 500,
    });
  });

  it("defaults starting balance to 0 when never set", async () => {
    await prisma.account.create({ data: { name: "Fresh Account", currency: "JPY" } });

    const [account] = await getAllAccounts();
    expect(account.startingBalance).toBe(0);
    expect(account.currentBalance).toBe(0);
  });
});

describe("updateAccountStartingBalance", () => {
  it("sets the starting balance, converting dollars to cents", async () => {
    const account = await prisma.account.create({ data: { name: "Cash", currency: "JPY" } });

    await updateAccountStartingBalance(account.id, 250000.5);

    const [row] = await getAllAccounts();
    expect(row.startingBalance).toBe(250000.5);
  });

  it("allows a negative starting balance", async () => {
    const account = await prisma.account.create({ data: { name: "Credit Card", currency: "JPY" } });

    await updateAccountStartingBalance(account.id, -30000);

    const [row] = await getAllAccounts();
    expect(row.startingBalance).toBe(-30000);
  });
});

describe("createAccount", () => {
  it("creates a new active account with the given starting balance", async () => {
    await createAccount({ name: "New Wallet", currency: "IDR", startingBalance: 500000 });

    const accounts = await getAllAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      name: "New Wallet",
      currency: "IDR",
      startingBalance: 500000,
      currentBalance: 500000,
    });
  });

  it("defaults starting balance to 0 when not given", async () => {
    await createAccount({ name: "New Wallet", currency: "JPY", startingBalance: 0 });

    const [account] = await getAllAccounts();
    expect(account.startingBalance).toBe(0);
  });
});

describe("deactivateAccount", () => {
  it("removes the account from getAllAccounts without deleting its transactions", async () => {
    const account = await prisma.account.create({ data: { name: "Old Wallet", currency: "JPY" } });
    const category = await prisma.category.create({ data: { name: "Groceries", type: "expense" } });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.UTC(2026, 7, 1)),
        amountCents: 10000,
        direction: "outflow",
        categoryId: category.id,
        accountId: account.id,
      },
    });

    await deactivateAccount(account.id);

    const accounts = await getAllAccounts();
    expect(accounts).toHaveLength(0);

    const transactionCount = await prisma.transaction.count({ where: { accountId: account.id } });
    expect(transactionCount).toBe(1);
  });
});
