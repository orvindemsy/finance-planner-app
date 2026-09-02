"use client";

import { useRef, useState } from "react";
import { addAccountAction } from "@/app/accounts/actions";

const INPUT = "border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600";

export function AddAccountForm() {
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addAccountAction(formData);
    formRef.current?.reset();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        + Add Account
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      <label className="flex flex-col gap-1 text-sm col-span-2">
        Name
        <input type="text" name="name" required className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Currency
        <select name="currency" required defaultValue="JPY" className={INPUT}>
          <option value="JPY">JPY</option>
          <option value="IDR">IDR</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Starting Balance
        <input type="number" name="startingBalance" step="0.01" defaultValue="0" className={INPUT} />
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
