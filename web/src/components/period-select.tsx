"use client";

import { useRouter } from "next/navigation";
import { PERIOD_COOKIE } from "@/lib/period-cookie";

// TODO: derive from the ledger tab once it exists, instead of hardcoding.
const YEARS = ["2026"];

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function PeriodSelect({
  year,
  month,
  currency,
  basePath = "/",
}: {
  year: string;
  month: string;
  currency?: string;
  basePath?: string;
}) {
  const router = useRouter();

  function navigate(newYear: string, newMonth: string) {
    const period = `${newYear}-${newMonth}`;
    document.cookie = `${PERIOD_COOKIE}=${period}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams({ period });
    if (currency) params.set("currency", currency);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1 text-sm">
        Year:
        <select
          value={year}
          onChange={(e) => navigate(e.target.value, month)}
          className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-sm">
        Month:
        <select
          value={month}
          onChange={(e) => navigate(year, e.target.value)}
          className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
