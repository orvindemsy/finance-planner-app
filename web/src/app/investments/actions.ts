"use server";

import { revalidatePath } from "next/cache";
import {
  addBlankHolding,
  updateHolding,
  deleteHolding,
  type HoldingFieldUpdate,
} from "@/lib/investments-query";

function revalidateInvestments() {
  revalidatePath("/investments/[currency]", "page");
  revalidatePath("/");
}

export async function addBlankHoldingAction(currency: string): Promise<void> {
  await addBlankHolding(currency);
  revalidateInvestments();
}

const EDITABLE_FIELDS = ["name", "quantity", "avgPrice", "marketPrice"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function updateHoldingFieldAction(id: number, field: string, value: string): Promise<void> {
  if (!EDITABLE_FIELDS.includes(field as EditableField)) {
    throw new Error(`Unknown field: ${field}`);
  }

  const update: HoldingFieldUpdate = {};

  switch (field as EditableField) {
    case "name": {
      if (value.trim() === "") throw new Error("Name is required");
      update.name = value;
      break;
    }
    case "quantity": {
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantity must be a non-negative number");
      update.quantity = Math.round(quantity);
      break;
    }
    case "avgPrice": {
      const avgPrice = Number(value);
      if (!Number.isFinite(avgPrice) || avgPrice < 0) throw new Error("Buy price must be a non-negative number");
      update.avgPrice = avgPrice;
      break;
    }
    case "marketPrice": {
      const marketPrice = Number(value);
      if (!Number.isFinite(marketPrice) || marketPrice < 0) throw new Error("Current price must be a non-negative number");
      update.marketPrice = marketPrice;
      break;
    }
  }

  await updateHolding(id, update);
  revalidateInvestments();
}

export async function deleteHoldingAction(id: number): Promise<void> {
  await deleteHolding(id);
  revalidateInvestments();
}
