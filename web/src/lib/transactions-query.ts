import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { periodBounds } from "./period";

const CENTS = 100;

export type TransactionListRow = {
  id: number;
  month: number;
  date: Date;
  direction: "inflow" | "outflow";
  categoryId: number;
  categoryName: string;
  accountId: number;
  accountName: string;
  currency: string;
  description: string | null;
  amount: number;
  status: "finalized" | "pending";
  notes: string | null;
};

export type TransactionFilters = {
  categoryId?: number;
  accountId?: number;
  direction?: "inflow" | "outflow";
  sort?: "asc" | "desc";
  sortBy?: "date" | "amount";
  search?: string;
  currency?: string;
};

export async function getTransactionsForPeriod(
  period: Date,
  filters: TransactionFilters = {}
): Promise<TransactionListRow[]> {
  const { start, end } = periodBounds(period);

  const where: Prisma.TransactionWhereInput = { date: { gte: start, lte: end } };
  if (filters.currency) where.account = { currency: filters.currency };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.direction) where.direction = filters.direction;

  const sortDir = filters.sort === "asc" ? "asc" : "desc";
  const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
    filters.sortBy === "amount" ? [{ amountCents: sortDir }, { id: sortDir }] : [{ date: sortDir }, { id: sortDir }];

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true },
    orderBy,
  });

  const rows = transactions.map((t) => ({
    id: t.id,
    month: t.date.getUTCMonth() + 1,
    date: t.date,
    direction: t.direction as "inflow" | "outflow",
    categoryId: t.categoryId,
    categoryName: t.category.name,
    accountId: t.accountId,
    accountName: t.account.name,
    currency: t.account.currency,
    description: t.description,
    amount: t.amountCents / CENTS,
    status: t.status as "finalized" | "pending",
    notes: t.notes,
  }));

  // Keyword search runs in JS rather than the DB query: SQLite's default
  // collation is case-sensitive, so Prisma's `contains` (no `insensitive`
  // mode support on SQLite) would miss differently-cased matches.
  const keyword = filters.search?.trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter((r) =>
    [r.description, r.notes, r.categoryName, r.accountName].some((field) => field?.toLowerCase().includes(keyword))
  );
}

// Running balance is intrinsic to each transaction's true chronological
// position in its account's history (like a bank statement) — it must be
// computed from ALL of that account's transactions (not just the currently
// displayed period or filter), ordered by (date, id) ascending, on top of
// the account's starting balance. Pending transactions haven't settled yet,
// so they don't move the running total — but they still get an entry in the
// returned map, carrying forward whatever the balance stood at just before
// them (same as the previous row), rather than being absent. The map is
// keyed by transaction id -> balance in dollars, so callers can look up a
// value per displayed row regardless of the table's current sort direction
// or category/direction filters.
export async function getRunningBalances(accountIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (accountIds.length === 0) return result;

  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } } });
  const runningCents = new Map<number, number>(accounts.map((a) => [a.id, a.startingBalanceCents]));

  const transactions = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  for (const t of transactions) {
    const current = runningCents.get(t.accountId) ?? 0;
    if (t.status === "finalized") {
      const delta = t.direction === "inflow" ? t.amountCents : -t.amountCents;
      const newRunning = current + delta;
      runningCents.set(t.accountId, newRunning);
      result.set(t.id, newRunning / CENTS);
    } else {
      // Pending: carry forward the balance unchanged.
      result.set(t.id, current / CENTS);
    }
  }

  return result;
}

export type CategoryOption = { id: number; name: string };
export type AccountOption = { id: number; name: string };

export async function getActiveCategories(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return categories.map((c) => ({ id: c.id, name: c.name }));
}

export async function getActiveAccounts(currency?: string): Promise<AccountOption[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true, ...(currency ? { currency } : {}) },
    orderBy: { name: "asc" },
  });
  return accounts.map((a) => ({ id: a.id, name: a.name }));
}

export type NewTransactionInput = {
  date: Date;
  direction: "inflow" | "outflow";
  categoryId: number;
  accountId: number;
  description: string | null;
  amount: number;
  status: "finalized" | "pending";
  notes: string | null;
};

export async function createTransaction(input: NewTransactionInput): Promise<void> {
  await prisma.transaction.create({
    data: {
      date: input.date,
      amountCents: Math.round(input.amount * CENTS),
      direction: input.direction,
      status: input.status,
      categoryId: input.categoryId,
      accountId: input.accountId,
      description: input.description,
      notes: input.notes,
    },
  });
}

export type NewTransferInput = {
  date: Date;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description: string | null;
};

// Internal transfers (e.g. withdrawing cash and charging it into a wallet
// app) move money between two of the user's own accounts — never income or
// expense. Both legs are tagged with the "Internal Transfer" category (a
// "transfer" type, already excluded from Income/Expense everywhere) and
// created atomically so a transfer can never end up with just one leg
// recorded, which is what caused every reconciliation gap found so far.
export async function createTransfer(input: NewTransferInput): Promise<void> {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("From and To accounts must be different");
  }

  const category = await prisma.category.findFirst({ where: { name: "Internal Transfer" } });
  if (!category) throw new Error("Internal Transfer category not found");

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: input.fromAccountId } }),
    prisma.account.findUniqueOrThrow({ where: { id: input.toAccountId } }),
  ]);

  if (fromAccount.currency !== toAccount.currency) {
    throw new Error("From and To accounts must be the same currency");
  }

  const amountCents = Math.round(input.amount * CENTS);

  await prisma.$transaction(async (tx) => {
    const outflow = await tx.transaction.create({
      data: {
        date: input.date,
        amountCents,
        direction: "outflow",
        status: "finalized",
        categoryId: category.id,
        accountId: input.fromAccountId,
        description: input.description ?? `Transfer to ${toAccount.name}`,
      },
    });
    const inflow = await tx.transaction.create({
      data: {
        date: input.date,
        amountCents,
        direction: "inflow",
        status: "finalized",
        categoryId: category.id,
        accountId: input.toAccountId,
        description: input.description ?? `Transfer from ${fromAccount.name}`,
        notes: `Paired with transaction #${outflow.id}`,
      },
    });
    await tx.transaction.update({
      where: { id: outflow.id },
      data: { notes: `Paired with transaction #${inflow.id}` },
    });
  });
}

export type TransactionFieldUpdate = {
  date?: Date;
  direction?: "inflow" | "outflow";
  categoryId?: number;
  accountId?: number;
  description?: string | null;
  amount?: number;
  status?: "finalized" | "pending";
  notes?: string | null;
};

export async function updateTransaction(id: number, update: TransactionFieldUpdate): Promise<void> {
  const { amount, ...rest } = update;
  await prisma.transaction.update({
    where: { id },
    data: {
      ...rest,
      ...(amount !== undefined ? { amountCents: Math.round(amount * CENTS) } : {}),
    },
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  await prisma.transaction.delete({ where: { id } });
}
