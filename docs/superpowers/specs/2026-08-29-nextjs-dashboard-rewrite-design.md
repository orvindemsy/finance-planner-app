# Next.js/Prisma Rewrite — Sub-project 1: Scaffolding + Dashboard

## Context

The current app is a FastAPI + Jinja2/htmx + SQLAlchemy/SQLite budget
tracker (self-hosted, single user, JPY + IDR ledgers). The goal is a
full rewrite onto a different stack, driven by wanting a different
tech stack rather than any specific feature complaint. The rewrite is
too large for one spec, so it's split into sub-projects, each with its
own design → plan → implementation cycle:

1. **Scaffolding + Dashboard** (this doc)
2. Transactions
3. Budgets
4. Categories
5. Accounts
6. Settings
7. CSV importer port

Feature scope overall is parity with the current app, plus specific
changes called out per page as they're designed (this doc covers the
Dashboard changes).

## Architecture

- **Framework**: Next.js (App Router, TypeScript).
- **Styling**: Tailwind CSS.
- **Data layer**: Prisma ORM + SQLite (matches current self-hosted,
  single-file-DB deployment model).
- **Data fetching**: Server Components query Prisma directly — no
  separate REST/JSON API layer, since this is a single-user,
  server-rendered-by-default app. Later sub-projects that need
  mutations (adding a transaction, editing a budget, etc.) use Server
  Actions.
- **Dark mode**: `next-themes`, class-based Tailwind dark mode
  strategy, toggle persisted via `next-themes` (localStorage), default
  to system preference. The toggle lives once in the root layout, so
  every future page gets it — not scoped to the Dashboard.
- **Deployment**: stays Dockerized, self-hosted, no auth (matches
  current README).

## Data model & migration

Prisma schema mirrors the current SQLAlchemy models 1:1:

- `Account` — id, name, currency, isActive, createdAt
- `Category` — id, name, type (enum: income/expense/savings/transfer),
  isActive, createdAt
- `Transaction` — id, date, amount, direction (enum: inflow/outflow),
  status (enum: finalized/pending), categoryId, accountId,
  description?, notes?, source?, externalRef?, createdAt, updatedAt
- `Budget` — id, categoryId, period, currency, plannedAmount, notes?,
  createdAt, updatedAt; unique(categoryId, period, currency)
- `BudgetDefault` — id, categoryId, currency, plannedAmount, createdAt,
  updatedAt; unique(categoryId, currency)

**Migration**: one-off Node script using `better-sqlite3` to read the
existing `budget.db` directly and insert rows via Prisma Client, in
FK-safe order (Accounts/Categories → Transactions →
Budgets/BudgetDefaults). Run once against the current `.db` file to
seed the new one. No ongoing dual-write or sync — this is a single
cutover.

**FX rates**: `app/services/fx.py` (Frankfurter API, 1hr in-memory
cache, `{jpy, idr, fetched_at, error}` shape) ports directly to an
equivalent TS module with the same caching behavior. No schema
involved.

## Dashboard page design

Layout, top to bottom:

1. **Header bar**: app title upper-left, with the currency toggle
   (JPY / IDR) directly under it, also upper-left. Dark-mode toggle
   upper-right. (Currently the currency toggle sits inline in the
   period-nav row — this moves it up into the header, per explicit
   request.)
2. **Period nav row**: a single month `<select>` dropdown listing all
   available months (all months with data, sorted). Selecting a month
   navigates via the existing `period` URL search param
   (`?period=YYYY-MM`), same mechanism as today. This **replaces** the
   prev/next arrows and the drag slider entirely — the dropdown is the
   only month-navigation control.
3. **Balance KPI row** (replaces the old Net Worth / Total Income /
   Total Spending row): two cards —
   - **JPY Account**: primary (large) value = balance converted into
     whichever currency is currently toggled; secondary (small font)
     value = the actual native JPY balance. When the toggle is JPY,
     the conversion is a no-op (same figure shown twice, in two type
     sizes, for visual consistency).
   - **IDR Account**: same pattern — primary value converted into the
     toggled currency, secondary value = actual native IDR balance.
   - **Balance definition**: all-time sum of signed transaction
     amounts per account currency — `SUM(CASE WHEN direction=inflow
     THEN amount ELSE -amount END)` across *all* transactions for
     accounts of that currency, all category types included. This is
     a literal running balance, distinct from the old "net worth"
     figure (which was income-minus-expense only, deliberately
     excluding savings/transfer movement as a proxy since account
     balances weren't tracked).
   - **Conversion**: IDR↔JPY cross-rate via USD, using the same
     Frankfurter-sourced rates already fetched for the FX rate cards
     below (no new rate source).
   - Total Income and Total Spending cards are removed.
4. **FX rate cards**: unchanged — USD/JPY, USD/IDR, "as of" timestamp,
   "unavailable" state if no rate has ever been fetched successfully.
5. **Period KPI row**: Income / Expense for the selected month only —
   unchanged from today (this was already scoped to the selected
   month; confirmed as-is, not a new behavior).
6. **Spending Breakdown** / **Income Breakdown** tables: unchanged —
   category, budget, actual, delta, for the selected month.
7. **Recent Transactions** table: unchanged — last 10, across all
   time, filtered to the selected currency.

Mechanics:

- Page is a Server Component; `period` and `currency` remain URL
  search params exactly as today, so links/back-button/bookmarking
  keep working. The currency toggle and month dropdown are plain
  navigations (a `<Link>`/form-based `<select>` that updates the URL),
  no client-side state needed for them.
- Dark-mode toggle is the one client component, added once in the root
  layout via `next-themes`.
- All KPI math (signed-amount aggregation, effective
  planned-by-category fallback merging `BudgetDefault` with
  period-specific `Budget` rows, balance calc, FX conversion) ports as
  plain TypeScript query functions calling Prisma — same logic as
  `dashboard.py`, translated.

## Error handling

- FX fetch failure: keep the last successfully cached rates; only show
  "unavailable" if no fetch has ever succeeded. Balance-card
  conversion falls back to showing the native value only (no converted
  primary figure) if no rate is available yet.
- Empty states: no accounts/transactions yet → month dropdown shows
  only the current month, breakdown tables show existing "no
  categories yet" messaging, balance cards show 0.
- Migration script fails loudly (no partial/silent writes) if the
  source DB is missing or a foreign-key reference can't be resolved —
  it's a one-off, deliberately not defensive.

## Testing

- Unit tests (TS, against a test SQLite DB via Prisma) for: the
  balance query per currency, the breakdown query functions, and the
  FX cross-rate conversion math.
- No e2e suite for this sub-project — manual verification in the
  browser against the migrated data is sufficient at this stage.
