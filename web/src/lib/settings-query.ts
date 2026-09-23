import { prisma } from "./prisma";

const CENTS = 100;
const MONTHLY_EXPENSE_KEY = "monthlyExpenseJpyCents";
const WITHDRAWAL_RATE_KEY = "withdrawalRatePercent";
const DEFAULT_WITHDRAWAL_RATE = 4;

// Estimated monthly expense is stored in JPY (the app's primary currency)
// and converted for display whenever the Dashboard's currency toggle is IDR.
export async function getMonthlyExpense(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: MONTHLY_EXPENSE_KEY } });
  return row ? Number(row.value) / CENTS : 0;
}

export async function setMonthlyExpense(amountJpy: number): Promise<void> {
  const value = String(Math.round(amountJpy * CENTS));
  await prisma.setting.upsert({
    where: { key: MONTHLY_EXPENSE_KEY },
    update: { value },
    create: { key: MONTHLY_EXPENSE_KEY, value },
  });
}

// The withdrawal rate behind the FIRE target (e.g. the "4% rule": target =
// annual expense / 4%, i.e. annual expense x 25). Currency-agnostic.
export async function getWithdrawalRate(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: WITHDRAWAL_RATE_KEY } });
  return row ? Number(row.value) : DEFAULT_WITHDRAWAL_RATE;
}

export async function setWithdrawalRate(percent: number): Promise<void> {
  const value = String(percent);
  await prisma.setting.upsert({
    where: { key: WITHDRAWAL_RATE_KEY },
    update: { value },
    create: { key: WITHDRAWAL_RATE_KEY, value },
  });
}
