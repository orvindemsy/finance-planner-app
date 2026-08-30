# Budget Tracker — Web (Next.js)

Next.js/Prisma rewrite of the budget-tracker dashboard. This directory is a
standalone Next.js app; see the repo root README for the overall project
scope.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

## Database

- `npm run db:migrate` — applies Prisma migrations to the local SQLite DB
  (`prisma/dev.db`).
- `npm run db:migrate-data` — a **one-off** script that imports data from the
  old app's SQLite DB (`../data/budget.db`) into this app's Prisma-managed
  DB. It is **not idempotent**: it creates rows with explicit ids inside a
  single transaction, so running it a second time against an already-populated
  database will fail (unique/id conflicts) and cleanly roll back — but you
  must reset the destination DB first if you need to re-run it:

  ```bash
  npx prisma migrate reset --force
  npm run db:migrate-data
  ```

## Lint

```bash
npm run lint
```
