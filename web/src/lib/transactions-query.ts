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
};

export async function getTransactionsForPeriod(
  period: Date,
  filters: TransactionFilters = {}
): Promise<TransactionListRow[]> {
  const { start, end } = periodBounds(period);

  const where: Prisma.TransactionWhereInput = { date: { gte: start, lte: end } };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.direction) where.direction = filters.direction;

  const sortDir = filters.sort === "asc" ? "asc" : "desc";

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true },
    orderBy: [{ date: sortDir }, { id: sortDir }],
  });

  return transactions.map((t) => ({
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

export async function getActiveAccounts(): Promise<AccountOption[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
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
