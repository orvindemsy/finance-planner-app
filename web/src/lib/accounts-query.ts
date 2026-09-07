import { prisma } from "./prisma";

const CENTS = 100;

export type AccountRow = {
  id: number;
  name: string;
  currency: string;
  startingBalance: number;
  currentBalance: number;
  note: string | null;
};

export async function getAllAccounts(): Promise<AccountRow[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { transactions: { where: { status: "finalized" } } },
    orderBy: { name: "asc" },
  });

  return accounts.map((a) => {
    const netCents = a.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      startingBalance: a.startingBalanceCents / CENTS,
      currentBalance: (a.startingBalanceCents + netCents) / CENTS,
      note: a.note,
    };
  });
}

export async function updateAccountStartingBalance(id: number, amount: number): Promise<void> {
  await prisma.account.update({
    where: { id },
    data: { startingBalanceCents: Math.round(amount * CENTS) },
  });
}

export async function updateAccountNote(id: number, note: string | null): Promise<void> {
  await prisma.account.update({
    where: { id },
    data: { note },
  });
}

export type NewAccountInput = {
  name: string;
  currency: string;
  startingBalance: number;
};

export async function createAccount(input: NewAccountInput): Promise<void> {
  await prisma.account.create({
    data: {
      name: input.name,
      currency: input.currency,
      startingBalanceCents: Math.round(input.startingBalance * CENTS),
    },
  });
}

// Soft-delete: an account's transactions are never removed (the relation has
// no cascade), so "deleting" deactivates it instead — it drops out of every
// active-accounts list (Accounts page, the Transactions form) while its
// historical transactions and balance math stay intact.
export async function deactivateAccount(id: number): Promise<void> {
  await prisma.account.update({
    where: { id },
    data: { isActive: false },
  });
}
