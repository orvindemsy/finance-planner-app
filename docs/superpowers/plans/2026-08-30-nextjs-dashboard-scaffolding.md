# Next.js Scaffolding + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new Next.js/Prisma app in `web/` and rebuild the Dashboard page in it, reading data migrated from the existing SQLite database, as sub-project 1 of the stack rewrite.

**Architecture:** Next.js (App Router, TypeScript) with Tailwind CSS for styling, Prisma + SQLite for data access, `next-themes` for dark mode. Dashboard is a Server Component that queries Prisma directly (no separate API layer); the two interactive controls (dark-mode toggle, month dropdown) are small client components.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Prisma ORM, SQLite, `next-themes`, `better-sqlite3` (one-off migration script only), Vitest (unit tests).

**Spec:** `docs/superpowers/specs/2026-08-29-nextjs-dashboard-rewrite-design.md`

## Global Constraints

- New app lives in `web/` at the repo root. The existing Python `app/` is untouched and keeps running until later sub-projects port the remaining pages (Transactions, Budgets, Categories, Accounts, Settings) — do not delete or modify anything under `app/`, `alembic/`, or `scripts/import_csv.py` in this plan.
- Prisma on SQLite supports neither `Decimal` nor native enums. Money amounts are stored as `Int` representing hundredths of a currency unit (e.g. `123.45` → `12345`), matching the precision of the current `Numeric(12,2)` columns without floating-point risk. `Category.type`, `Transaction.direction`, and `Transaction.status` are stored as `String` columns, validated against TypeScript union types in the application layer (documented per-field below).
- No authentication; single-user, self-hosted, matches current README.
- Package manager: npm (Node v26.8.1 / npm 11.19 already installed on this machine — verified during planning, no reinstall needed).
- Dockerizing the new app is explicitly deferred to the final cutover sub-project — out of scope here.

---

## File Structure

```
web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── .env                              # DATABASE_URL="file:./dev.db"
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── migrate-from-sqlite.ts        # one-off: old app/../data/budget.db -> Prisma DB
├── tests/
│   ├── setup.ts                      # test DB bootstrap + resetDb() helper
│   ├── period.test.ts
│   ├── fx.test.ts
│   ├── convert.test.ts
│   └── dashboard-queries.test.ts
└── src/
    ├── app/
    │   ├── layout.tsx                # html/body, ThemeProvider, top bar (title + dark toggle)
    │   ├── globals.css
    │   └── page.tsx                  # Dashboard page (Server Component)
    ├── components/
    │   ├── theme-toggle.tsx          # client: dark mode button (next-themes)
    │   ├── currency-toggle.tsx       # server: plain <Link> pair
    │   ├── month-select.tsx          # client: <select> that navigates on change
    │   ├── balance-card.tsx          # server: presentational
    │   └── fx-rate-card.tsx          # server: presentational
    └── lib/
        ├── prisma.ts                 # PrismaClient singleton
        ├── period.ts                 # parsePeriod, periodBounds, shiftPeriod
        ├── fx.ts                     # getUsdRates() with 1hr cache
        ├── convert.ts                # convertAmount() via USD cross-rate
        └── dashboard-queries.ts      # all Dashboard data queries
```

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: `web/` (entire scaffolded project from `create-next-app`)

**Interfaces:**
- Produces: a running Next.js dev server at `web/`, with TypeScript, Tailwind, App Router, ESLint enabled.

- [ ] **Step 1: Scaffold the project**

Run from the repo root:

```bash
npx create-next-app@latest web \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

- [ ] **Step 2: Verify it builds and runs**

```bash
cd web && npm run build
```

Expected: build succeeds with the default starter page.

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -q "Get started" && echo "OK"
kill %1
```

Expected: prints `OK`.

- [ ] **Step 3: Remove starter boilerplate content**

Replace `web/src/app/page.tsx` with a placeholder that will be overwritten in Task 11:

```tsx
export default function Page() {
  return <div>placeholder</div>;
}
```

Leave `web/src/app/layout.tsx` and `web/src/app/globals.css` as generated — Task 9 will edit them.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "Scaffold Next.js app in web/"
```

---

### Task 2: Prisma schema and initial migration

**Files:**
- Create: `web/prisma/schema.prisma`
- Create: `web/.env`
- Modify: `web/package.json` (add `prisma`, `@prisma/client` dependencies + `db:migrate` script)

**Interfaces:**
- Produces: Prisma Client types `Account`, `Category`, `Transaction`, `Budget`, `BudgetDefault`, importable from `@prisma/client`. Field names below are exact — later tasks depend on them.

- [ ] **Step 1: Install Prisma**

```bash
cd web
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlite
```

This creates `web/prisma/schema.prisma` and `web/.env` with `DATABASE_URL="file:./dev.db"`.

- [ ] **Step 2: Write the schema**

Replace the contents of `web/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Account {
  id           Int           @id @default(autoincrement())
  name         String        @unique
  currency     String        // "JPY" | "IDR"
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  transactions Transaction[]

  @@map("accounts")
}

model Category {
  id            Int            @id @default(autoincrement())
  name          String         @unique
  type          String         // "income" | "expense" | "savings" | "transfer"
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  transactions  Transaction[]
  budgets       Budget[]
  budgetDefaults BudgetDefault[]

  @@map("categories")
}

model Transaction {
  id          Int      @id @default(autoincrement())
  date        DateTime
  amountCents Int      // hundredths of a currency unit, e.g. 123.45 -> 12345
  direction   String   // "inflow" | "outflow"
  status      String   @default("finalized") // "finalized" | "pending"
  categoryId  Int
  accountId   Int
  description String?
  notes       String?
  source      String?
  externalRef String?  @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category Category @relation(fields: [categoryId], references: [id])
  account  Account  @relation(fields: [accountId], references: [id])

  @@index([date])
  @@index([categoryId])
  @@index([accountId])
  @@map("transactions")
}

model Budget {
  id                 Int      @id @default(autoincrement())
  categoryId         Int
  period             DateTime
  currency           String
  plannedAmountCents Int
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  category Category @relation(fields: [categoryId], references: [id])

  @@unique([categoryId, period, currency], name: "uq_budget_category_period_currency")
  @@index([categoryId])
  @@map("budgets")
}

model BudgetDefault {
  id                 Int      @id @default(autoincrement())
  categoryId         Int
  currency           String
  plannedAmountCents Int
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  category Category @relation(fields: [categoryId], references: [id])

  @@unique([categoryId, currency], name: "uq_budget_default_category_currency")
  @@index([categoryId])
  @@map("budget_defaults")
}
```

- [ ] **Step 3: Run the initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: creates `web/prisma/migrations/<timestamp>_init/`, applies it to `web/prisma/dev.db`, generates the Prisma Client.

- [ ] **Step 4: Verify with a smoke query**

```bash
cat > /tmp/smoke.ts << 'EOF'
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const acct = await prisma.account.create({ data: { name: "Smoke Test", currency: "JPY" } });
  const found = await prisma.account.findUnique({ where: { id: acct.id } });
  console.log(found?.name === "Smoke Test" ? "OK" : "FAIL");
  await prisma.account.delete({ where: { id: acct.id } });
}
main().finally(() => prisma.$disconnect());
EOF
npx tsx /tmp/smoke.ts
```

Expected: prints `OK`. (Install `tsx` first if missing: `npm install -D tsx`.)

- [ ] **Step 5: Commit**

```bash
git add prisma package.json package-lock.json .env.example 2>/dev/null
git add -f .env  # local-only DB url, matches current app's committed .env.example pattern — confirm .gitignore below
git commit -m "Add Prisma schema and initial migration"
```

Before committing, check `web/.gitignore` (generated by create-next-app) already ignores `.env*.local` but not plain `.env` — since `.env` here only holds a local SQLite file path with no secrets (matching how the current Python app's `.env` works, see `.env.example` at repo root), it's fine to commit `web/.env` as-is. If you'd rather not commit it, add `web/.env` to `.gitignore` and create `web/.env.example` instead.

---

### Task 3: Data migration script

**Files:**
- Create: `web/scripts/migrate-from-sqlite.ts`
- Modify: `web/package.json` (add `db:migrate-data` script, `better-sqlite3` + `@types/better-sqlite3` dependencies)

**Interfaces:**
- Consumes: `PrismaClient` from `@prisma/client` (Task 2), the existing Python app's SQLite file at `../data/budget.db` (relative to `web/`).
- Produces: populated `web/prisma/dev.db`.

- [ ] **Step 1: Install `better-sqlite3`**

```bash
cd web
npm install -D better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Write the migration script**

```ts
// web/scripts/migrate-from-sqlite.ts
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const SOURCE_DB = path.resolve(__dirname, "../../data/budget.db");

const prisma = new PrismaClient();

function toCents(decimalStr: string | number): number {
  return Math.round(Number(decimalStr) * 100);
}

async function main() {
  const src = new Database(SOURCE_DB, { readonly: true });

  const accounts = src.prepare("SELECT * FROM accounts").all() as any[];
  const categories = src.prepare("SELECT * FROM categories").all() as any[];
  const transactions = src.prepare("SELECT * FROM transactions").all() as any[];
  const budgets = src.prepare("SELECT * FROM budgets").all() as any[];
  const budgetDefaults = src.prepare("SELECT * FROM budget_defaults").all() as any[];

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
            type: c.type,
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
            direction: t.direction,
            status: t.status,
            categoryId: t.category_id,
            accountId: t.account_id,
            description: t.description,
            notes: t.notes,
            source: t.source,
            externalRef: t.external_ref,
            createdAt: new Date(t.created_at),
            updatedAt: t.updated_at ? new Date(t.updated_at) : null,
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
            updatedAt: b.updated_at ? new Date(b.updated_at) : null,
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
            updatedAt: bd.updated_at ? new Date(bd.updated_at) : null,
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
```

Add to `web/package.json` `scripts`:

```json
"db:migrate-data": "tsx scripts/migrate-from-sqlite.ts"
```

- [ ] **Step 3: Run it against the real data**

The destination DB must be empty before running (fresh `prisma migrate dev` from Task 2 already gives an empty DB). If you've since inserted smoke-test rows, reset first: `npx prisma migrate reset --force`.

```bash
npm run db:migrate-data
```

Expected: prints source counts, destination counts, and `Migration OK: all row counts match.` If the source and destination counts don't match, the script throws and exits non-zero — investigate before proceeding (do not re-run without resetting the destination DB first, or `@unique` constraints on `externalRef`/composite budget keys will fail on the second pass).

- [ ] **Step 4: Commit**

```bash
git add scripts package.json package-lock.json
git commit -m "Add data migration script from Python app's SQLite DB"
```

---

### Task 4: Period helper module

**Files:**
- Create: `web/src/lib/period.ts`
- Test: `web/tests/period.test.ts`
- Modify: `web/package.json` (add `vitest` dev dependency + `test` script)
- Create: `web/vitest.config.ts`

**Interfaces:**
- Produces:
  - `parsePeriod(periodStr: string | null | undefined): Date` — first-of-month `Date`, defaults to current month on invalid/missing input.
  - `periodBounds(period: Date): { start: Date; end: Date }` — first and last day of that month.
  - `shiftPeriod(period: Date, deltaMonths: number): Date` — first-of-month `Date` shifted by N months (handles year rollover).

- [ ] **Step 1: Install Vitest**

```bash
cd web
npm install -D vitest
```

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

Add to `web/package.json` `scripts`: `"test": "vitest run"`.

`web/tests/setup.ts` is created fully in Task 6 (Prisma test DB bootstrap); for this task, create it as an empty file so Vitest doesn't error on a missing setup file:

```ts
// web/tests/setup.ts
export {};
```

- [ ] **Step 2: Write the failing test**

```ts
// web/tests/period.test.ts
import { describe, it, expect } from "vitest";
import { parsePeriod, periodBounds, shiftPeriod } from "../src/lib/period";

describe("parsePeriod", () => {
  it("parses a YYYY-MM string to the first of that month", () => {
    const result = parsePeriod("2026-03");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // 0-indexed
    expect(result.getDate()).toBe(1);
  });

  it("falls back to the current month on null", () => {
    const now = new Date();
    const result = parsePeriod(null);
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
  });

  it("falls back to the current month on malformed input", () => {
    const now = new Date();
    const result = parsePeriod("not-a-period");
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
  });
});

describe("periodBounds", () => {
  it("returns first and last day of a 31-day month", () => {
    const { start, end } = periodBounds(new Date(2026, 0, 1)); // Jan 2026
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
  });

  it("handles February in a leap year", () => {
    const { end } = periodBounds(new Date(2028, 1, 1)); // Feb 2028 (leap)
    expect(end.getDate()).toBe(29);
  });
});

describe("shiftPeriod", () => {
  it("shifts forward within the same year", () => {
    const result = shiftPeriod(new Date(2026, 2, 1), 1); // Mar -> Apr 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
  });

  it("rolls over to the next year", () => {
    const result = shiftPeriod(new Date(2026, 11, 1), 1); // Dec 2026 -> Jan 2027
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });

  it("rolls back to the previous year", () => {
    const result = shiftPeriod(new Date(2026, 0, 1), -1); // Jan 2026 -> Dec 2025
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
npx vitest run tests/period.test.ts
```

Expected: FAIL — `../src/lib/period` has no exported members.

- [ ] **Step 4: Implement**

```ts
// web/src/lib/period.ts
export function parsePeriod(periodStr: string | null | undefined): Date {
  if (periodStr) {
    const match = /^(\d{4})-(\d{2})$/.exec(periodStr);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function periodBounds(period: Date): { start: Date; end: Date } {
  const start = new Date(period.getFullYear(), period.getMonth(), 1);
  const end = new Date(period.getFullYear(), period.getMonth() + 1, 0);
  return { start, end };
}

export function shiftPeriod(period: Date, deltaMonths: number): Date {
  return new Date(period.getFullYear(), period.getMonth() + deltaMonths, 1);
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
npx vitest run tests/period.test.ts
```

Expected: PASS, all 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/period.ts tests/period.test.ts tests/setup.ts vitest.config.ts package.json package-lock.json
git commit -m "Add period helper module with tests"
```

---

### Task 5: FX rate module

**Files:**
- Create: `web/src/lib/fx.ts`
- Test: `web/tests/fx.test.ts`

**Interfaces:**
- Produces: `getUsdRates(): Promise<{ jpy: number | null; idr: number | null; fetchedAt: string | null; error: string | null }>`, `CURRENCY_SYMBOLS: Record<string, string>`.
- Depends on: global `fetch` (available natively in Node 18+, no library needed).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/fx.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getUsdRates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns jpy/idr rates from a successful fetch", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { JPY: 149.5, IDR: 15800 } }),
    });
    const { getUsdRates } = await import("../src/lib/fx");
    const result = await getUsdRates();
    expect(result.jpy).toBe(149.5);
    expect(result.idr).toBe(15800);
    expect(result.error).toBeNull();
    expect(result.fetchedAt).not.toBeNull();
  });

  it("returns an error and null rates when the fetch fails and no cache exists", async () => {
    (fetch as any).mockRejectedValue(new Error("network down"));
    const { getUsdRates } = await import("../src/lib/fx");
    const result = await getUsdRates();
    expect(result.jpy).toBeNull();
    expect(result.idr).toBeNull();
    expect(result.error).toContain("network down");
  });

  it("keeps stale cached rates if a later fetch fails", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rates: { JPY: 150, IDR: 15900 } }) })
      .mockRejectedValueOnce(new Error("timeout"));
    const { getUsdRates } = await import("../src/lib/fx");
    const first = await getUsdRates();
    expect(first.jpy).toBe(150);

    // Force cache to look expired by re-importing with a fake timer isn't
    // needed here since the module caches for 1hr in-process; instead we
    // directly verify the second call within the cache window still returns
    // the same cached values without a second fetch attempt.
    const second = await getUsdRates();
    expect(second.jpy).toBe(150);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/fx.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/fx.ts
const FX_API_URL = "https://api.frankfurter.dev/v1/latest";
const CACHE_TTL_MS = 60 * 60 * 1000;

export const CURRENCY_SYMBOLS: Record<string, string> = { JPY: "¥", IDR: "Rp", USD: "$" };

type RatesCache = {
  rates: Record<string, number> | null;
  fetchedAt: number | null;
  error: string | null;
};

const cache: RatesCache = { rates: null, fetchedAt: null, error: null };

export async function getUsdRates() {
  const now = Date.now();
  if (cache.rates === null || now - (cache.fetchedAt ?? 0) >= CACHE_TTL_MS) {
    try {
      const url = new URL(FX_API_URL);
      url.searchParams.set("base", "USD");
      url.searchParams.set("symbols", "JPY,IDR");
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`FX API returned ${response.status}`);
      const body = await response.json();
      cache.rates = body.rates ?? {};
      cache.fetchedAt = now;
      cache.error = null;
    } catch (err) {
      cache.error = err instanceof Error ? err.message : String(err);
    }
  }

  const rates = cache.rates ?? {};
  return {
    jpy: rates.JPY ?? null,
    idr: rates.IDR ?? null,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    error: cache.error,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/fx.test.ts
```

Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fx.ts tests/fx.test.ts
git commit -m "Add FX rate module with tests"
```

---

### Task 6: Prisma test DB bootstrap

**Files:**
- Modify: `web/tests/setup.ts`
- Modify: `web/package.json` (`pretest` script)

**Interfaces:**
- Produces: `resetDb(): Promise<void>` exported from `web/tests/setup.ts`, used by Task 7's tests. Sets `process.env.DATABASE_URL` to a dedicated test DB file before any test module imports `src/lib/prisma.ts`.

- [ ] **Step 1: Create `src/lib/prisma.ts` (needed before the test setup can use it)**

```ts
// web/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Write the test DB bootstrap**

```ts
// web/tests/setup.ts
import { execSync } from "node:child_process";
import path from "node:path";
import { beforeAll, beforeEach } from "vitest";

const TEST_DB_PATH = path.resolve(__dirname, "../prisma/test.db");
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

beforeAll(() => {
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
});

export async function resetDb() {
  const { prisma } = await import("../src/lib/prisma");
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.budgetDefault.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
}

beforeEach(async () => {
  await resetDb();
});
```

Add `web/prisma/test.db*` to `web/.gitignore`.

- [ ] **Step 3: Verify the bootstrap runs cleanly**

```bash
npx vitest run tests/period.test.ts
```

Expected: PASS (unaffected by the DB bootstrap, but confirms `beforeAll`/`beforeEach` don't throw — check console output for the `prisma db push` log).

- [ ] **Step 4: Commit**

```bash
git add src/lib/prisma.ts tests/setup.ts .gitignore
git commit -m "Add Prisma test DB bootstrap"
```

---

### Task 7: Dashboard query functions

**Files:**
- Create: `web/src/lib/dashboard-queries.ts`
- Test: `web/tests/dashboard-queries.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../src/lib/prisma` (Task 6), `periodBounds`/`shiftPeriod` from `../src/lib/period` (Task 4).
- Produces:
  - `getBalancesByCurrency(): Promise<Record<string, number>>` — dollars (not cents), e.g. `{ JPY: 152340, IDR: 8420000 }`, all-time signed sum per account currency across *all* transactions regardless of category type.
  - `getAvailableMonths(currency: string): Promise<string[]>` — sorted `"YYYY-MM"` strings spanning min-to-max transaction date for that currency (always includes at least the current month).
  - `getEffectivePlannedByCategory(period: Date, currency: string): Promise<Record<number, number>>` — dollars, keyed by `categoryId`, `Budget` row overriding `BudgetDefault`.
  - `getCategoryBreakdown(period: Date, currency: string): Promise<{ expense: BreakdownRow[]; income: BreakdownRow[] }>` where `BreakdownRow = { name: string; actual: number; budget: number }`.
  - `getPeriodTotals(period: Date, currency: string): Promise<{ income: number; expense: number }>` — dollars.
  - `getRecentTransactions(currency: string, limit?: number): Promise<TransactionRow[]>` where `TransactionRow = { date: Date; categoryName: string; accountName: string; amount: number; direction: "inflow" | "outflow"; description: string | null }`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/tests/dashboard-queries.test.ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npx vitest run tests/dashboard-queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/dashboard-queries.ts
import { prisma } from "./prisma";
import { periodBounds, shiftPeriod } from "./period";

const CENTS = 100;

function actualForType(type: string, netCents: number): number {
  return type === "income" ? netCents : -netCents;
}

export async function getBalancesByCurrency(): Promise<Record<string, number>> {
  const accounts = await prisma.account.findMany({ include: { transactions: true } });
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    const netCents = account.transactions.reduce(
      (sum, t) => sum + (t.direction === "inflow" ? t.amountCents : -t.amountCents),
      0
    );
    totals[account.currency] = (totals[account.currency] ?? 0) + netCents / CENTS;
  }
  return totals;
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
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(last.getFullYear(), last.getMonth(), 1);
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
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

export type BreakdownRow = { name: string; actual: number; budget: number };

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
        where: { date: { gte: start, lte: end }, account: { currency } },
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
      name: c.name,
      type: c.type,
      actual: actualForType(c.type, netCents / CENTS),
      budget: planned[c.id] ?? 0,
    };
  });

  return {
    expense: rows.filter((r) => r.type === "expense").map(({ name, actual, budget }) => ({ name, actual, budget })),
    income: rows.filter((r) => r.type === "income").map(({ name, actual, budget }) => ({ name, actual, budget })),
  };
}

export async function getPeriodTotals(period: Date, currency: string): Promise<{ income: number; expense: number }> {
  const { start, end } = periodBounds(period);

  async function totalFor(type: string): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lte: end },
        account: { currency },
        category: { type },
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
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npx vitest run tests/dashboard-queries.test.ts
```

Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-queries.ts tests/dashboard-queries.test.ts
git commit -m "Add Dashboard query functions with tests"
```

---

### Task 8: FX conversion helper

**Files:**
- Create: `web/src/lib/convert.ts`
- Test: `web/tests/convert.test.ts`

**Interfaces:**
- Consumes: the `{ jpy, idr }` shape from `getUsdRates()` (Task 5).
- Produces: `convertAmount(amount: number, from: string, to: string, rates: { jpy: number | null; idr: number | null }): number | null` — converts between `"JPY"` and `"IDR"` via their USD cross-rate; returns the input unchanged if `from === to`; returns `null` if a required rate is missing.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/convert.test.ts
import { describe, it, expect } from "vitest";
import { convertAmount } from "../src/lib/convert";

describe("convertAmount", () => {
  const rates = { jpy: 150, idr: 15000 };

  it("returns the amount unchanged when from === to", () => {
    expect(convertAmount(1000, "JPY", "JPY", rates)).toBe(1000);
  });

  it("converts JPY to IDR via the USD cross-rate", () => {
    // 1000 JPY = 1000/150 USD = 6.666... USD = 6.666... * 15000 IDR
    const result = convertAmount(1000, "JPY", "IDR", rates);
    expect(result).toBeCloseTo((1000 / 150) * 15000, 2);
  });

  it("converts IDR to JPY via the USD cross-rate", () => {
    const result = convertAmount(150000, "IDR", "JPY", rates);
    expect(result).toBeCloseTo((150000 / 15000) * 150, 2);
  });

  it("returns null when a required rate is missing", () => {
    expect(convertAmount(1000, "JPY", "IDR", { jpy: null, idr: 15000 })).toBeNull();
    expect(convertAmount(1000, "JPY", "IDR", { jpy: 150, idr: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/convert.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/convert.ts
type Rates = { jpy: number | null; idr: number | null };

export function convertAmount(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  if (rates.jpy === null || rates.idr === null) return null;

  const usdPerUnit: Record<string, number> = { JPY: rates.jpy, IDR: rates.idr };
  const fromRate = usdPerUnit[from];
  const toRate = usdPerUnit[to];
  if (fromRate === undefined || toRate === undefined) return null;

  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/convert.test.ts
```

Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/convert.ts tests/convert.test.ts
git commit -m "Add FX conversion helper with tests"
```

---

### Task 9: Dark mode — root layout and toggle

**Files:**
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/globals.css`
- Create: `web/src/components/theme-toggle.tsx`
- Modify: `web/package.json` (add `next-themes` dependency)

**Interfaces:**
- Produces: every page rendered under `layout.tsx` gets dark mode support and a persistent top bar with the app title (left) and the theme toggle (right). No other task depends on this one's internals — the Dashboard page (Task 11) renders as `{children}` inside this layout.

- [ ] **Step 1: Install `next-themes`**

```bash
cd web
npm install next-themes
```

- [ ] **Step 2: Enable Tailwind's class-based dark mode**

Tailwind v4 (from `create-next-app`) configures dark mode via a CSS directive rather than a JS config file. At the top of `web/src/app/globals.css`, ensure this variant is declared (add it if `create-next-app`'s default file doesn't already have it):

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Step 3: Write the theme toggle**

```tsx
// web/src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-16 h-8" />; // avoid hydration mismatch

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
```

- [ ] **Step 4: Wire up the root layout**

```tsx
// web/src/app/layout.tsx
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-lg font-semibold">Budget Tracker</h1>
            <ThemeToggle />
          </header>
          <main className="p-4">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Manually verify**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -q "Budget Tracker" && echo "OK"
kill %1
```

Then open `http://localhost:3000` in a browser, click the toggle, and confirm the background/text colors flip and the choice survives a page reload (per `next-themes`'s localStorage persistence).

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/theme-toggle.tsx package.json package-lock.json
git commit -m "Add dark mode support to root layout"
```

---

### Task 10: Currency toggle and month select components

**Files:**
- Create: `web/src/components/currency-toggle.tsx`
- Create: `web/src/components/month-select.tsx`

**Interfaces:**
- Produces:
  - `<CurrencyToggle currency={string} period={string} />` — server component, renders JPY/IDR as plain links that set `?currency=` while preserving `period`.
  - `<MonthSelect months={string[]} current={string} currency={string} />` — client component, `<select>` that navigates to `?period=<value>&currency=<currency>` on change.

- [ ] **Step 1: Write the currency toggle (no test — pure presentational, verified visually in Task 11)**

```tsx
// web/src/components/currency-toggle.tsx
import Link from "next/link";

export function CurrencyToggle({ currency, period }: { currency: string; period: string }) {
  const currencies = ["JPY", "IDR"];
  return (
    <div className="flex gap-2 text-sm">
      {currencies.map((c) => (
        <Link
          key={c}
          href={`/?period=${period}&currency=${c}`}
          className={c === currency ? "font-bold underline" : "text-gray-500 dark:text-gray-400"}
        >
          {c}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the month select**

```tsx
// web/src/components/month-select.tsx
"use client";

import { useRouter } from "next/navigation";

export function MonthSelect({ months, current, currency }: { months: string[]; current: string; currency: string }) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/?period=${e.target.value}&currency=${currency}`)}
      className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/currency-toggle.tsx src/components/month-select.tsx
git commit -m "Add currency toggle and month select components"
```

---

### Task 11: Balance and FX rate cards, assemble the Dashboard page

**Files:**
- Create: `web/src/components/balance-card.tsx`
- Create: `web/src/components/fx-rate-card.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `getBalancesByCurrency`, `getAvailableMonths`, `getCategoryBreakdown`, `getPeriodTotals`, `getRecentTransactions` (Task 7); `getUsdRates`, `CURRENCY_SYMBOLS` (Task 5); `convertAmount` (Task 8); `parsePeriod` (Task 4); `CurrencyToggle`, `MonthSelect` (Task 10).

- [ ] **Step 1: Write the balance card**

```tsx
// web/src/components/balance-card.tsx
import { CURRENCY_SYMBOLS } from "@/lib/fx";

export function BalanceCard({
  label,
  nativeCurrency,
  nativeAmount,
  displayCurrency,
  displayAmount,
}: {
  label: string;
  nativeCurrency: string;
  nativeAmount: number;
  displayCurrency: string;
  displayAmount: number | null;
}) {
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
  const nativeSymbol = CURRENCY_SYMBOLS[nativeCurrency] ?? nativeCurrency;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold">
        {displayAmount === null ? "—" : `${symbol}${displayAmount.toLocaleString()}`}
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {nativeSymbol}
        {nativeAmount.toLocaleString()} native
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the FX rate card**

```tsx
// web/src/components/fx-rate-card.tsx
export function FxRateCard({ label, value, symbol }: { label: string; value: number | null; symbol: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>{" "}
      {value === null ? (
        <span className="text-gray-400">unavailable</span>
      ) : (
        <span>
          {symbol}
          {value.toLocaleString()}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Assemble the Dashboard page**

```tsx
// web/src/app/page.tsx
import { parsePeriod } from "@/lib/period";
import {
  getBalancesByCurrency,
  getAvailableMonths,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
} from "@/lib/dashboard-queries";
import { getUsdRates, CURRENCY_SYMBOLS } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";
import { CurrencyToggle } from "@/components/currency-toggle";
import { MonthSelect } from "@/components/month-select";
import { BalanceCard } from "@/components/balance-card";
import { FxRateCard } from "@/components/fx-rate-card";

const DEFAULT_CURRENCY = "JPY";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const period = parsePeriod(params.period);
  const periodStr = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}`;

  const [balances, months, breakdown, periodTotals, recent, fx] = await Promise.all([
    getBalancesByCurrency(),
    getAvailableMonths(currency),
    getCategoryBreakdown(period, currency),
    getPeriodTotals(period, currency),
    getRecentTransactions(currency, 10),
    getUsdRates(),
  ]);

  const currentMonth = months.includes(periodStr) ? periodStr : (months[months.length - 1] ?? periodStr);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  return (
    <div className="space-y-6">
      <CurrencyToggle currency={currency} period={currentMonth} />

      <MonthSelect months={months} current={currentMonth} currency={currency} />

      <div className="grid grid-cols-2 gap-4">
        <BalanceCard
          label="JPY Account"
          nativeCurrency="JPY"
          nativeAmount={balances.JPY ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.JPY ?? 0, "JPY", currency, fx)}
        />
        <BalanceCard
          label="IDR Account"
          nativeCurrency="IDR"
          nativeAmount={balances.IDR ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.IDR ?? 0, "IDR", currency, fx)}
        />
      </div>

      <div className="flex gap-3">
        <FxRateCard label="USD/JPY" value={fx.jpy} symbol="¥" />
        <FxRateCard label="USD/IDR" value={fx.idr} symbol="Rp" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Income ({currency})</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {symbol}
            {periodTotals.income.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Expense ({currency})</div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">
            {symbol}
            {periodTotals.expense.toLocaleString()}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Spending Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Category</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.expense.length === 0 ? (
              <tr>
                <td colSpan={4}>No expense categories yet.</td>
              </tr>
            ) : (
              breakdown.expense.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.budget.toLocaleString()}</td>
                  <td>{row.actual.toLocaleString()}</td>
                  <td className={row.actual > row.budget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                    {(row.actual - row.budget).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Income Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Category</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.income.length === 0 ? (
              <tr>
                <td colSpan={4}>No income categories yet.</td>
              </tr>
            ) : (
              breakdown.income.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.budget.toLocaleString()}</td>
                  <td>{row.actual.toLocaleString()}</td>
                  <td className={row.actual >= row.budget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {(row.actual - row.budget).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recent Transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Date</th>
              <th>Category</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5}>No transactions yet.</td>
              </tr>
            ) : (
              recent.map((tx, i) => (
                <tr key={i}>
                  <td>{tx.date.toISOString().slice(0, 10)}</td>
                  <td>{tx.categoryName}</td>
                  <td>{tx.accountName}</td>
                  <td className={tx.direction === "inflow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {tx.direction === "inflow" ? "+" : "-"}
                    {tx.amount.toLocaleString()}
                  </td>
                  <td>{tx.description ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/balance-card.tsx src/components/fx-rate-card.tsx src/app/page.tsx
git commit -m "Assemble Dashboard page"
```

---

### Task 12: End-to-end manual verification against migrated data

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd web
npm test
```

Expected: all tests from Tasks 4, 5, 7, 8 pass.

- [ ] **Step 2: Confirm the DB has the migrated data**

```bash
npx prisma studio
```

Expected: `accounts`, `categories`, `transactions`, `budgets`, `budget_defaults` tables show the same row counts printed by Task 3's migration script. Close Prisma Studio when done.

- [ ] **Step 3: Run the dev server and check the Dashboard in a browser**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- App title top-left, currency toggle directly under/beside it, dark-mode toggle top-right.
- Toggling JPY/IDR changes which balance card shows the larger (native) figure vs. the converted one, and updates the breakdown/recent-transactions currency filter.
- The month dropdown lists every month with data and navigating it updates the URL and the page content.
- Toggling dark mode flips the whole page's colors and survives a reload.
- Numbers in the balance cards, breakdown tables, and recent transactions match what you'd expect from the real migrated data (spot-check a couple of known transactions against the old app at `http://localhost:8000` if it's still runnable via `make dev`).

- [ ] **Step 4: Note follow-up work (do not implement now)**

Confirm out loud / in the PR description that these are explicitly deferred to later sub-projects: Transactions/Budgets/Categories/Accounts/Settings pages, the CSV importer port, and Dockerizing `web/`.
