"use server";

import { revalidatePath } from "next/cache";
import { createTransaction, updateTransaction, type TransactionFieldUpdate } from "@/lib/transactions-query";

export async function addTransactionAction(formData: FormData): Promise<void> {
  const dateStr = formData.get("date");
  const direction = formData.get("direction");
  const categoryId = formData.get("categoryId");
  const accountId = formData.get("accountId");
  const description = formData.get("description");
  const amountStr = formData.get("amount");
  const status = formData.get("status");
  const notes = formData.get("notes");

  if (
    typeof dateStr !== "string" ||
    !dateStr ||
    typeof direction !== "string" ||
    (direction !== "inflow" && direction !== "outflow") ||
    typeof categoryId !== "string" ||
    !categoryId ||
    typeof accountId !== "string" ||
    !accountId ||
    typeof amountStr !== "string" ||
    !amountStr ||
    typeof status !== "string" ||
    (status !== "finalized" && status !== "pending")
  ) {
    throw new Error("Missing or invalid required field");
  }

  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  await createTransaction({
    date: new Date(dateStr),
    direction,
    categoryId: Number(categoryId),
    accountId: Number(accountId),
    description: typeof description === "string" && description.trim() !== "" ? description : null,
    amount,
    status,
    notes: typeof notes === "string" && notes.trim() !== "" ? notes : null,
  });

  revalidatePath("/transactions");
  revalidatePath("/");
}

const EDITABLE_FIELDS = [
  "date",
  "direction",
  "categoryId",
  "accountId",
  "description",
  "amount",
  "status",
  "notes",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function updateTransactionFieldAction(id: number, field: string, value: string): Promise<void> {
  if (!EDITABLE_FIELDS.includes(field as EditableField)) {
    throw new Error(`Unknown field: ${field}`);
  }

  const update: TransactionFieldUpdate = {};

  switch (field as EditableField) {
    case "date": {
      if (!value) throw new Error("Date is required");
      update.date = new Date(value);
      break;
    }
    case "direction": {
      if (value !== "inflow" && value !== "outflow") throw new Error("Invalid cashflow direction");
      update.direction = value;
      break;
    }
    case "categoryId": {
      const categoryId = Number(value);
      if (!Number.isInteger(categoryId)) throw new Error("Invalid category");
      update.categoryId = categoryId;
      break;
    }
    case "accountId": {
      const accountId = Number(value);
      if (!Number.isInteger(accountId)) throw new Error("Invalid payment type");
      update.accountId = accountId;
      break;
    }
    case "description": {
      update.description = value.trim() === "" ? null : value;
      break;
    }
    case "amount": {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number");
      update.amount = amount;
      break;
    }
    case "status": {
      if (value !== "finalized" && value !== "pending") throw new Error("Invalid status");
      update.status = value;
      break;
    }
    case "notes": {
      update.notes = value.trim() === "" ? null : value;
      break;
    }
  }

  await updateTransaction(id, update);
  revalidatePath("/transactions");
  revalidatePath("/");
}
