"use server";

import { revalidatePath } from "next/cache";
import { parsePeriod } from "@/lib/period";
import { setBudgetForCategory } from "@/lib/dashboard-queries";

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
