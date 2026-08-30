"use client";

import { useRouter } from "next/navigation";

export function MonthSelect({ months, current, currency }: { months: string[]; current: string; currency: string }) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/?period=${e.target.value}&currency=${currency}`)}
      className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
