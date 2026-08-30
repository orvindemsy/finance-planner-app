// web/scripts/migrate-from-sqlite.ts
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const SOURCE_DB = path.resolve(__dirname, "../../data/budget.db");

const prisma = new PrismaClient();

function toCents(decimalStr: string | number): number {
  return Math.round(Number(decimalStr) * 100);
}

// Minimal row shapes matching the columns actually read below. The source
// SQLite DB is a fixed, already-finalized schema from the old app, so these
// are just enough typing to remove `any` without ceremony.
type SourceAccountRow = {
  id: number;
  name: string;
  currency: string;
  is_active: number;
  created_at: string;
};
type SourceCategoryRow = {
  id: number;
  name: string;
  type: string;
  is_active: number;
  created_at: string;
};
type SourceTransactionRow = {
  id: number;
  date: string;
  amount: string | number;
  direction: string;
  status: string;
  category_id: number;
  account_id: number;
  description: string | null;
  notes: string | null;
  source: string | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string | null;
};
type SourceBudgetRow = {
  id: number;
  category_id: number;
  period: string;
  currency: string;
  planned_amount: string | number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};
type SourceBudgetDefaultRow = {
  id: number;
  category_id: number;
  currency: string;
  planned_amount: string | number;
  created_at: string;
  updated_at: string | null;
};

async function main() {
  const src = new Database(SOURCE_DB, { readonly: true });

  const accounts = src.prepare("SELECT * FROM accounts").all() as SourceAccountRow[];
  const categories = src.prepare("SELECT * FROM categories").all() as SourceCategoryRow[];
  const transactions = src.prepare("SELECT * FROM transactions").all() as SourceTransactionRow[];
  const budgets = src.prepare("SELECT * FROM budgets").all() as SourceBudgetRow[];
  const budgetDefaults = src.prepare("SELECT * FROM budget_defaults").all() as SourceBudgetDefaultRow[];

  console.log(
    `Source: ${accounts.length} accounts, ${categories.length} categories, ` +
    `${transactions.length} transactions, ${budgets.length} budgets, ${budgetDefaults.length} budget_defaults`
  );

  // Wrapped in a single transaction so a failure partway through (e.g. an
  // unresolved FK reference) rolls back everything instead of leaving a
  // half-migrated destination DB.
  await prisma.$transaction(
    async (tx) => {
      for (const a of accounts) {
        await tx.account.create({
          data: {
            id: a.id,
            name: a.name,
            currency: a.currency,
            isActive: !!a.is_active,
            createdAt: new Date(a.created_at),
          },
        });
      }

      for (const c of categories) {
        await tx.category.create({
          data: {
            id: c.id,
            name: c.name,
            type: c.type.toLowerCase(),
            isActive: !!c.is_active,
            createdAt: new Date(c.created_at),
          },
        });
      }

      for (const t of transactions) {
        await tx.transaction.create({
          data: {
            id: t.id,
            date: new Date(t.date),
            amountCents: toCents(t.amount),
            direction: t.direction.toLowerCase(),
            status: t.status.toLowerCase(),
            categoryId: t.category_id,
            accountId: t.account_id,
            description: t.description,
            notes: t.notes,
            source: t.source,
            externalRef: t.external_ref,
            createdAt: new Date(t.created_at),
            // Transaction.updatedAt is a non-nullable @updatedAt field; the
            // source column is nullable (never updated since creation), so
            // fall back to createdAt rather than passing null.
            updatedAt: new Date(t.updated_at ?? t.created_at),
          },
        });
      }

      for (const b of budgets) {
        await tx.budget.create({
          data: {
            id: b.id,
            categoryId: b.category_id,
            period: new Date(b.period),
            currency: b.currency,
            plannedAmountCents: toCents(b.planned_amount),
            notes: b.notes,
            createdAt: new Date(b.created_at),
            // See note above on Transaction.updatedAt.
            updatedAt: new Date(b.updated_at ?? b.created_at),
          },
        });
      }

      for (const bd of budgetDefaults) {
        await tx.budgetDefault.create({
          data: {
            id: bd.id,
            categoryId: bd.category_id,
            currency: bd.currency,
            plannedAmountCents: toCents(bd.planned_amount),
            createdAt: new Date(bd.created_at),
            // See note above on Transaction.updatedAt.
            updatedAt: new Date(bd.updated_at ?? bd.created_at),
          },
        });
      }
    },
    { timeout: 60_000 }
  );

  const counts = {
    accounts: await prisma.account.count(),
    categories: await prisma.category.count(),
    transactions: await prisma.transaction.count(),
    budgets: await prisma.budget.count(),
    budgetDefaults: await prisma.budgetDefault.count(),
  };
  console.log("Destination row counts:", counts);

  if (
    counts.accounts !== accounts.length ||
    counts.categories !== categories.length ||
    counts.transactions !== transactions.length ||
    counts.budgets !== budgets.length ||
    counts.budgetDefaults !== budgetDefaults.length
  ) {
    throw new Error("Row count mismatch after migration — aborting, check output above.");
  }

  console.log("Migration OK: all row counts match.");
  src.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
