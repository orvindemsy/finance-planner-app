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
  await prisma.holding.deleteMany();
  await prisma.setting.deleteMany();
}

beforeEach(async () => {
  await resetDb();
});
