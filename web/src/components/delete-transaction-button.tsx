"use client";

import { useState } from "react";
import { deleteTransactionAction } from "@/app/transactions/actions";

export function DeleteTransactionButton({
  id,
  description,
  notes,
}: {
  id: number;
  description: string | null;
  notes: string | null;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const pairedMatch = notes?.match(/Paired with transaction #(\d+)/);
    const label = description ? `"${description}"` : "this transaction";
    const message = pairedMatch
      ? `Delete ${label}? This is one leg of an internal transfer (paired with transaction #${pairedMatch[1]}) — deleting it will leave the other side unbalanced. This can't be undone.`
      : `Delete ${label}? This can't be undone.`;

    if (!window.confirm(message)) return;

    setPending(true);
    try {
      await deleteTransactionAction(id);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={pending ? "Deleting…" : "Delete"}
      aria-label={pending ? "Deleting…" : "Delete"}
      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
