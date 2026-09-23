"use server";

import { revalidatePath } from "next/cache";
import { parsePeriod } from "@/lib/period";
import { setBudgetForCategory } from "@/lib/dashboard-queries";
import { setMonthlyExpense, setWithdrawalRate } from "@/lib/settings-query";
import { getUsdRates } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";

export async function updateBudgetAction(
  categoryId: number,
  periodStr: string,
  currency: string,
  value: string
): Promise<void> {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Budget must be a non-negative number");
  }

  await setBudgetForCategory(categoryId, parsePeriod(periodStr), currency, amount);
  revalidatePath("/");
}

// `value` is entered in whichever currency the Dashboard's toggle is
// currently showing; it's converted back to JPY (the canonical storage
// currency) before saving so the figure "follows" the toggle either way.
export async function updateMonthlyExpenseAction(currencySlug: string, value: string): Promise<void> {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Monthly expense must be a non-negative number");
  }

  const currency = currencySlug === "idr" ? "IDR" : "JPY";
  let amountJpy = amount;
  if (currency !== "JPY") {
    const fx = await getUsdRates();
    const converted = convertAmount(amount, currency, "JPY", fx);
    if (converted === null) throw new Error("Exchange rate unavailable, try again shortly");
    amountJpy = converted;
  }

  await setMonthlyExpense(amountJpy);
  revalidatePath("/dashboard/[currency]", "page");
}

export async function updateWithdrawalRateAction(value: string): Promise<void> {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    throw new Error("Withdrawal rate must be a number between 0 and 100");
  }

  await setWithdrawalRate(percent);
  revalidatePath("/dashboard/[currency]", "page");
}
