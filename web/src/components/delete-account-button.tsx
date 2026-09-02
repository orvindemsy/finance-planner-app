"use client";

import { useState } from "react";
import { deleteAccountAction } from "@/app/accounts/actions";

export function DeleteAccountButton({ id, name }: { id: number; name: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Remove "${name}"? Its past transactions are kept, but it won't be selectable anymore.`)) {
      return;
    }
    setPending(true);
    try {
      await deleteAccountAction(id);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Delete"}
    </button>
  );
}
