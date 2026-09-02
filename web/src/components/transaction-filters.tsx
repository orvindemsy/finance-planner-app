"use client";

import { useRouter } from "next/navigation";

const SELECT = "border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm";

export function TransactionFilters({
  year,
  month,
  categoryId,
  accountId,
  direction,
  categories,
  accounts,
}: {
  year: string;
  month: string;
  categoryId: string;
  accountId: string;
  direction: string;
  categories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
}) {
  const router = useRouter();

  function navigate(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      period: `${year}-${month}`,
      category: categoryId,
      account: accountId,
      direction,
      ...overrides,
    });
    for (const [key, value] of Array.from(params.entries())) {
      if (value === "all") params.delete(key);
    }
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1 text-sm">
        Category:
        <select
          value={categoryId}
          onChange={(e) => navigate({ category: e.target.value })}
          className={SELECT}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-sm">
        Payment Type:
        <select
          value={accountId}
          onChange={(e) => navigate({ account: e.target.value })}
          className={SELECT}
        >
          <option value="all">All Payment Types</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-sm">
        Cashflow:
        <select
          value={direction}
          onChange={(e) => navigate({ direction: e.target.value })}
          className={SELECT}
        >
          <option value="all">All</option>
          <option value="inflow">Inflow</option>
          <option value="outflow">Outflow</option>
        </select>
      </label>
    </div>
  );
}
