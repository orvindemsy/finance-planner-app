"use server";

import { revalidatePath } from "next/cache";
import {
  updateAccountStartingBalance,
  updateAccountNote,
  createAccount,
  deactivateAccount,
} from "@/lib/accounts-query";

export async function updateStartingBalanceAction(id: number, value: string): Promise<void> {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error("Starting balance must be a number");
  }

  await updateAccountStartingBalance(id, amount);
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function updateAccountNoteAction(id: number, value: string): Promise<void> {
  await updateAccountNote(id, value.trim() === "" ? null : value);
  revalidatePath("/accounts");
}

export async function addAccountAction(formData: FormData): Promise<void> {
  const name = formData.get("name");
  const currency = formData.get("currency");
  const startingBalanceStr = formData.get("startingBalance");

  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("Account name is required");
  }
  if (typeof currency !== "string" || (currency !== "JPY" && currency !== "IDR")) {
    throw new Error("Invalid currency");
  }

  const startingBalance =
    typeof startingBalanceStr === "string" && startingBalanceStr.trim() !== "" ? Number(startingBalanceStr) : 0;
  if (!Number.isFinite(startingBalance)) {
    throw new Error("Starting balance must be a number");
  }

  await createAccount({ name: name.trim(), currency, startingBalance });
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/transactions/[currency]", "page");
}

export async function deleteAccountAction(id: number): Promise<void> {
  await deactivateAccount(id);
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/transactions/[currency]", "page");
}
