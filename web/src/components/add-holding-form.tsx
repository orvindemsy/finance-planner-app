"use client";

import { useState } from "react";
import { addBlankHoldingAction } from "@/app/investments/actions";

export function AddHoldingForm({ currency }: { currency: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await addBlankHoldingAction(currency);
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
      {pending ? "Adding…" : "+ Add Holding"}
    </button>
  );
}
