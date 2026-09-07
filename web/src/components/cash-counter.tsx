"use client";

import { useMemo, useState } from "react";

const DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

const INPUT = "border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 w-24 text-right";

export function CashCounter() {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});

  const total = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (Number(counts[d]) || 0), 0),
    [counts]
  );

  function setCount(denomination: number, value: string) {
    setCounts((prev) => ({ ...prev, [denomination]: value }));
  }

  function reset() {
    setCounts({});
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        + Cash Counter
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cash Counter</h3>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
            Reset
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {DENOMINATIONS.map((d) => {
          const count = Number(counts[d]) || 0;
          return (
            <label key={d} className="flex flex-col gap-1 text-sm">
              ¥{d.toLocaleString()}
              <input
                type="number"
                min="0"
                step="1"
                value={counts[d] ?? ""}
                onChange={(e) => setCount(d, e.target.value)}
                placeholder="0"
                className={INPUT}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                = ¥{(d * count).toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
        <span className="text-xl font-bold">¥{total.toLocaleString()}</span>
      </div>
    </div>
  );
}
