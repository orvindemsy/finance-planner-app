"use server";

import { revalidatePath } from "next/cache";
import {
  createTransaction,
  createTransfer,
  updateTransaction,
  deleteTransaction,
  type TransactionFieldUpdate,
} from "@/lib/transactions-query";

// The Transactions page now lives at /transactions/[currency] (jpy/idr);
// this revalidates every currency variant plus the Dashboard.
function revalidateTransactions() {
  revalidatePath("/transactions/[currency]", "page");
  revalidatePath("/");
}

// Creates a blank placeholder transaction (amount 0, outflow, finalized) dated
// to the first day of the given period, using the first available category
// and account as defaults. The row then appears in the table below, editable
// cell-by-cell via the same click-to-edit UI as every other transaction —
// there's no separate add-transaction form.
export async function addBlankTransactionAction(
  dateStr: string,
  categoryId: number,
  accountId: number
): Promise<void> {
  await createTransaction({
    date: new Date(dateStr),
    direction: "outflow",
    categoryId,
    accountId,
    description: null,
    amount: 0,
    status: "finalized",
    notes: null,
  });

  revalidateTransactions();
}

export async function addTransferAction(formData: FormData): Promise<void> {
  const dateStr = formData.get("date");
  const fromAccountId = formData.get("fromAccountId");
  const toAccountId = formData.get("toAccountId");
  const amountStr = formData.get("amount");
  const description = formData.get("description");

  if (
    typeof dateStr !== "string" ||
    !dateStr ||
    typeof fromAccountId !== "string" ||
    !fromAccountId ||
    typeof toAccountId !== "string" ||
    !toAccountId ||
    typeof amountStr !== "string" ||
    !amountStr
  ) {
    throw new Error("Missing or invalid required field");
  }

  if (fromAccountId === toAccountId) {
    throw new Error("From and To accounts must be different");
  }

  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  await createTransfer({
    date: new Date(dateStr),
    fromAccountId: Number(fromAccountId),
    toAccountId: Number(toAccountId),
    amount,
    description: typeof description === "string" && description.trim() !== "" ? description : null,
  });

  revalidateTransactions();
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
  revalidateTransactions();
}

export async function deleteTransactionAction(id: number): Promise<void> {
  await deleteTransaction(id);
  revalidateTransactions();
}
