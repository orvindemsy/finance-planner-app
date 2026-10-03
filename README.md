# About
An attempt to make application where I can track my monthly budget.

A self-hosted budget tracker: FastAPI + server-rendered Jinja2/htmx frontend,
SQLAlchemy models on SQLite (migratable to Postgres later via Alembic).

## Setup

```
make install
cp .env.example .env
make migrate
```

## Import historical data from a Google Sheet export

The importer expects two ledger exports (one per currency), matching the
personal-budget sheet layout:

1. Export the JPY ledger tab as CSV to `data/csv_import/ledger_jpy.csv`, with
   columns `Month, Date, Cashflow, Category, Payment Type, Description, Amount, Status, Notes`
   (`Cashflow` is `Outflow`/`Inflow`; `Date` is Japanese `MM月DD日`, no year).
2. Export the IDR ledger tab as CSV to `data/csv_import/ledger_idr.csv`, with
   columns `Month, Date, Category, Payment Type, Expense, Income` (direction
   comes from whichever of `Expense`/`Income` is filled in).
3. If your sheet uses category names not already listed, add them to
   `CATEGORY_TYPE_MAP` at the top of `scripts/import_csv.py` — unmapped
   categories are skipped with a warning rather than guessed.
4. Preview without writing to the database: `make import-dry-run YEAR=2026`
5. Run the real import: `make import YEAR=2026` (safe to re-run — duplicate
   rows are skipped). `YEAR` must match the calendar year the sheet's dates
   belong to. Add `--sheet ledger_jpy` / `--sheet ledger_idr` directly to
   `scripts/import_csv.py`'s invocation to import just one ledger.

## Run locally

```
make dev
```
Then open http://localhost:8000

## Run with Docker

```
make build-amd   # or build-arm on Apple Silicon
make run
```
