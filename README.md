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

1. Export each sheet tab as CSV (e.g. `income.csv`, `expenses.csv`) into `data/csv_import/`.
2. Edit the `SHEET_CONFIGS` mapping at the top of `scripts/import_csv.py` to match your
   sheet's actual column names.
3. Preview without writing to the database: `make import-dry-run`
4. Run the real import: `make import` (safe to re-run — duplicate rows are skipped)

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
