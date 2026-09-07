import Link from "next/link";
import { cookies } from "next/headers";
import { parsePeriod } from "@/lib/period";
import {
  getBalancesByCurrency,
  getAccountBalancesByCurrency,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
  type BreakdownRow,
} from "@/lib/dashboard-queries";
import { getUsdRates, CURRENCY_SYMBOLS } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";
import { PeriodSelect } from "@/components/period-select";
import { BalanceCard } from "@/components/balance-card";
import { FxRateCard } from "@/components/fx-rate-card";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { TH, TH_RIGHT, TD, TD_RIGHT, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { EditableCell } from "@/components/editable-cell";
import { updateBudgetAction } from "./actions";
import { PERIOD_COOKIE } from "@/lib/period-cookie";
import { HIDE_AMOUNTS_COOKIE } from "@/lib/privacy-cookie";

const MASK = "••••";

const DEFAULT_CURRENCY = "JPY";

const BREAKDOWN_COLUMNS: { key: "category" | "budget" | "actual" | "delta"; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "budget", label: "Budget" },
  { key: "actual", label: "Actual" },
  { key: "delta", label: "Delta" },
];

function sortBreakdown(
  rows: BreakdownRow[],
  key: "category" | "budget" | "actual" | "delta",
  dir: "asc" | "desc"
): BreakdownRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "category") return factor * a.name.localeCompare(b.name);
    const av = key === "budget" ? a.budget : key === "actual" ? a.actual : a.actual - a.budget;
    const bv = key === "budget" ? b.budget : key === "actual" ? b.actual : b.actual - b.budget;
    return factor * (av - bv);
  });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    currency?: string;
    spendingSort?: string;
    spendingDir?: string;
    incomeSort?: string;
    incomeDir?: string;
  }>;
}) {
  const params = await searchParams;
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const cookieStore = await cookies();
  const period = parsePeriod(params.period ?? cookieStore.get(PERIOD_COOKIE)?.value);
  const hideAmounts = cookieStore.get(HIDE_AMOUNTS_COOKIE)?.value === "1";
  const year = String(period.getUTCFullYear());
  const month = String(period.getUTCMonth() + 1).padStart(2, "0");
  const periodStr = `${year}-${month}`;

  const spendingSort = (["category", "budget", "actual", "delta"] as const).includes(
    params.spendingSort as "category" | "budget" | "actual" | "delta"
  )
    ? (params.spendingSort as "category" | "budget" | "actual" | "delta")
    : "category";
  const spendingDir = params.spendingDir === "desc" ? "desc" : "asc";
  const incomeSort = (["category", "budget", "actual", "delta"] as const).includes(
    params.incomeSort as "category" | "budget" | "actual" | "delta"
  )
    ? (params.incomeSort as "category" | "budget" | "actual" | "delta")
    : "category";
  const incomeDir = params.incomeDir === "desc" ? "desc" : "asc";

  function sortLink(table: "spending" | "income", col: "category" | "budget" | "actual" | "delta") {
    const isActive = table === "spending" ? spendingSort === col : incomeSort === col;
    const curDir = table === "spending" ? spendingDir : incomeDir;
    const nextDir = isActive && curDir === "asc" ? "desc" : "asc";
    const p = new URLSearchParams({ period: periodStr, currency });
    p.set("spendingSort", table === "spending" ? col : spendingSort);
    p.set("spendingDir", table === "spending" ? nextDir : spendingDir);
    p.set("incomeSort", table === "income" ? col : incomeSort);
    p.set("incomeDir", table === "income" ? nextDir : incomeDir);
    return `/?${p.toString()}`;
  }

  const [balances, jpyAccountBalances, idrAccountBalances, breakdown, periodTotals, recent, fx] = await Promise.all([
    getBalancesByCurrency(period),
    getAccountBalancesByCurrency(period, "JPY"),
    getAccountBalancesByCurrency(period, "IDR"),
    getCategoryBreakdown(period, currency),
    getPeriodTotals(period, currency),
    getRecentTransactions(currency, 10),
    getUsdRates(),
  ]);

  const sortedExpense = sortBreakdown(breakdown.expense, spendingSort, spendingDir);
  const sortedIncome = sortBreakdown(breakdown.income, incomeSort, incomeDir);

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const asOfLabel = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    period
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 items-center">
        <div className="flex items-center gap-3">
          <PeriodSelect year={year} month={month} currency={currency} />
          <PrivacyToggle hidden={hideAmounts} />
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <FxRateCard
              label="USD/JPY"
              value={fx.jpy}
              symbol="¥"
              currency="JPY"
              isActive={currency === "JPY"}
              href={`/?period=${periodStr}&currency=JPY`}
            />
            <FxRateCard
              label="USD/IDR"
              value={fx.idr}
              symbol="Rp"
              currency="IDR"
              isActive={currency === "IDR"}
              href={`/?period=${periodStr}&currency=IDR`}
            />
          </div>
          {fx.fetchedAt !== null && (
            <span className="text-xs text-gray-400 dark:text-gray-500">as of {fx.fetchedAt}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BalanceCard
          label="JPY Account"
          nativeCurrency="JPY"
          nativeAmount={balances.JPY ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.JPY ?? 0, "JPY", currency, fx)}
          asOfLabel={asOfLabel}
          hidden={hideAmounts}
          breakdown={jpyAccountBalances}
        />
        <BalanceCard
          label="IDR Account"
          nativeCurrency="IDR"
          nativeAmount={balances.IDR ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.IDR ?? 0, "IDR", currency, fx)}
          asOfLabel={asOfLabel}
          hidden={hideAmounts}
          breakdown={idrAccountBalances}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Income ({currency})</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {hideAmounts ? (
              MASK
            ) : (
              <>
                {symbol}
                {periodTotals.income.toLocaleString()}
              </>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Expense ({currency})</div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">
            {symbol}
            {periodTotals.expense.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className={CARD}>
          <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">Spending</h2>
          <div className={TABLE_SCROLL}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {BREAKDOWN_COLUMNS.map((col) => (
                    <th key={col.key} className={col.key === "category" ? TH : TH_RIGHT}>
                      <Link href={sortLink("spending", col.key)} className="hover:underline">
                        {col.label} {spendingSort === col.key ? (spendingDir === "asc" ? "▲" : "▼") : ""}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedExpense.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${TD} text-gray-400 dark:text-gray-500`}>
                      No expense categories yet.
                    </td>
                  </tr>
                ) : (
                  sortedExpense.map((row) => (
                    <tr key={row.categoryId} className={TR_HOVER}>
                      <td className={TD}>{row.name}</td>
                      <EditableCell
                        value={String(row.budget)}
                        displayValue={row.budget.toLocaleString()}
                        editor={{ kind: "number", min: 0 }}
                        onSave={updateBudgetAction.bind(null, row.categoryId, periodStr, currency)}
                        className={TD_RIGHT}
                      />
                      <td className={TD_RIGHT}>{row.actual.toLocaleString()}</td>
                      <td className={`${TD_RIGHT} ${row.actual > row.budget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {(row.actual - row.budget).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={CARD}>
          <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">Income</h2>
          <div className={TABLE_SCROLL}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {BREAKDOWN_COLUMNS.map((col) => (
                    <th key={col.key} className={col.key === "category" ? TH : TH_RIGHT}>
                      <Link href={sortLink("income", col.key)} className="hover:underline">
                        {col.label} {incomeSort === col.key ? (incomeDir === "asc" ? "▲" : "▼") : ""}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedIncome.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${TD} text-gray-400 dark:text-gray-500`}>
                      No income categories yet.
                    </td>
                  </tr>
                ) : (
                  sortedIncome.map((row) => (
                    <tr key={row.categoryId} className={TR_HOVER}>
                      <td className={TD}>{row.name}</td>
                      <EditableCell
                        value={String(row.budget)}
                        displayValue={hideAmounts ? MASK : row.budget.toLocaleString()}
                        editor={{ kind: "number", min: 0 }}
                        onSave={updateBudgetAction.bind(null, row.categoryId, periodStr, currency)}
                        className={TD_RIGHT}
                      />
                      <td className={TD_RIGHT}>{hideAmounts ? MASK : row.actual.toLocaleString()}</td>
                      <td className={`${TD_RIGHT} ${row.actual >= row.budget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {hideAmounts ? MASK : (row.actual - row.budget).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className={CARD}>
        <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">Recent Transactions</h2>
        <div className={TABLE_SCROLL}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Category</th>
                <th className={TH}>Account</th>
                <th className={TH_RIGHT}>Amount</th>
                <th className={TH}>Description</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${TD} text-gray-400 dark:text-gray-500`}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                recent.map((tx, i) => (
                  <tr key={i} className={TR_HOVER}>
                    <td className={TD}>{tx.date.toISOString().slice(0, 10)}</td>
                    <td className={TD}>{tx.categoryName}</td>
                    <td className={TD}>{tx.accountName}</td>
                    <td className={`${TD_RIGHT} ${tx.direction === "inflow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {hideAmounts && tx.direction === "inflow" ? (
                        MASK
                      ) : (
                        <>
                          {tx.direction === "inflow" ? "+" : "-"}
                          {tx.amount.toLocaleString()}
                        </>
                      )}
                    </td>
                    <td className={TD}>{tx.description ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
