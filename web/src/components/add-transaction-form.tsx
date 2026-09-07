"use client";

import { useState } from "react";
import { addBlankTransactionAction } from "@/app/transactions/actions";

export function AddTransactionForm({
  defaultDate,
  defaultCategoryId,
  defaultAccountId,
}: {
  defaultDate: string;
  defaultCategoryId: number;
  defaultAccountId: number;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await addBlankTransactionAction(defaultDate, defaultCategoryId, defaultAccountId);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
    >
      {pending ? "Adding…" : "+ Add Transaction"}
    </button>
  );
}
