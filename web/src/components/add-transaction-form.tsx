"use client";

import { useRef, useState } from "react";
import { addTransactionAction } from "@/app/transactions/actions";

const INPUT = "border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600";

export function AddTransactionForm({
  categories,
  accounts,
}: {
  categories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addTransactionAction(formData);
    formRef.current?.reset();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        + Add Transaction
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Date
        <input type="date" name="date" required className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Cashflow
        <select name="direction" required defaultValue="outflow" className={INPUT}>
          <option value="outflow">Outflow</option>
          <option value="inflow">Inflow</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Category
        <select name="categoryId" required defaultValue="" className={INPUT}>
          <option value="" disabled>
            Select…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Payment Type
        <select name="accountId" required defaultValue="" className={INPUT}>
          <option value="" disabled>
            Select…
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-2">
        Description
        <input type="text" name="description" className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input type="number" name="amount" step="0.01" min="0" required className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select name="status" required defaultValue="finalized" className={INPUT}>
          <option value="finalized">Finalized</option>
          <option value="pending">Pending</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-2">
        Notes
        <input type="text" name="notes" className={INPUT} />
      </label>

      <div className="col-span-full flex gap-2">
        <button type="submit" className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700">
          Save
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
