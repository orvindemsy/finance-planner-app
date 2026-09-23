"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_FILTER_COOKIE, ACCOUNT_FILTER_COOKIE, DIRECTION_FILTER_COOKIE } from "@/lib/transaction-filters-cookie";

const SELECT = "border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function TransactionFilters({
  currencySlug,
  year,
  month,
  categoryId,
  accountId,
  direction,
  search,
  categories,
  accounts,
}: {
  currencySlug: string;
  year: string;
  month: string;
  categoryId: string;
  accountId: string;
  direction: string;
  search: string;
  categories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);
  const categoryCookie = `${CATEGORY_FILTER_COOKIE}-${currencySlug}`;
  const accountCookie = `${ACCOUNT_FILTER_COOKIE}-${currencySlug}`;
  const directionCookie = `${DIRECTION_FILTER_COOKIE}-${currencySlug}`;

  function navigate(overrides: Record<string, string>) {
    const merged = { category: categoryId, account: accountId, direction, search, ...overrides };
    setCookie(categoryCookie, merged.category);
    setCookie(accountCookie, merged.account);
    setCookie(directionCookie, merged.direction);

    const params = new URLSearchParams({ period: `${year}-${month}`, ...merged });
    for (const [key, value] of Array.from(params.entries())) {
      if (value === "all" || value === "") params.delete(key);
    }
    router.push(`/transactions/${currencySlug}?${params.toString()}`);
  }

  function submitSearch() {
    navigate({ search: searchInput.trim() });
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
      <div className="flex items-center gap-1 text-sm">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          placeholder="Search description, notes..."
          className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm w-56"
        />
        <button
          onClick={submitSearch}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => {
              setSearchInput("");
              navigate({ search: "" });
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
