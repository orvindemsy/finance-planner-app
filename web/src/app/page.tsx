import { parsePeriod } from "@/lib/period";
import {
  getBalancesByCurrency,
  getAvailableMonths,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
} from "@/lib/dashboard-queries";
import { getUsdRates, CURRENCY_SYMBOLS } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";
import { CurrencyToggle } from "@/components/currency-toggle";
import { MonthSelect } from "@/components/month-select";
import { BalanceCard } from "@/components/balance-card";
import { FxRateCard } from "@/components/fx-rate-card";

const DEFAULT_CURRENCY = "JPY";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const requestedPeriod = parsePeriod(params.period);
  const periodStr = `${requestedPeriod.getUTCFullYear()}-${String(requestedPeriod.getUTCMonth() + 1).padStart(2, "0")}`;

  const months = await getAvailableMonths(currency);
  const currentMonth = months.includes(periodStr) ? periodStr : (months[months.length - 1] ?? periodStr);
  const period = parsePeriod(currentMonth);

  const [balances, breakdown, periodTotals, recent, fx] = await Promise.all([
    getBalancesByCurrency(),
    getCategoryBreakdown(period, currency),
    getPeriodTotals(period, currency),
    getRecentTransactions(currency, 10),
    getUsdRates(),
  ]);

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  return (
    <div className="space-y-6">
      <CurrencyToggle currency={currency} period={currentMonth} />

      <MonthSelect months={months} current={currentMonth} currency={currency} />

      <div className="grid grid-cols-2 gap-4">
        <BalanceCard
          label="JPY Account"
          nativeCurrency="JPY"
          nativeAmount={balances.JPY ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.JPY ?? 0, "JPY", currency, fx)}
        />
        <BalanceCard
          label="IDR Account"
          nativeCurrency="IDR"
          nativeAmount={balances.IDR ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.IDR ?? 0, "IDR", currency, fx)}
        />
      </div>

      <div className="flex items-center gap-3">
        <FxRateCard label="USD/JPY" value={fx.jpy} symbol="¥" />
        <FxRateCard label="USD/IDR" value={fx.idr} symbol="Rp" />
        {fx.fetchedAt !== null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">as of {fx.fetchedAt}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Income ({currency})</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {symbol}
            {periodTotals.income.toLocaleString()}
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

      <section>
        <h2 className="text-lg font-semibold mb-2">Spending Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Category</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.expense.length === 0 ? (
              <tr>
                <td colSpan={4}>No expense categories yet.</td>
              </tr>
            ) : (
              breakdown.expense.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.budget.toLocaleString()}</td>
                  <td>{row.actual.toLocaleString()}</td>
                  <td className={row.actual > row.budget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                    {(row.actual - row.budget).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Income Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Category</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.income.length === 0 ? (
              <tr>
                <td colSpan={4}>No income categories yet.</td>
              </tr>
            ) : (
              breakdown.income.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.budget.toLocaleString()}</td>
                  <td>{row.actual.toLocaleString()}</td>
                  <td className={row.actual >= row.budget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {(row.actual - row.budget).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recent Transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Date</th>
              <th>Category</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5}>No transactions yet.</td>
              </tr>
            ) : (
              recent.map((tx, i) => (
                <tr key={i}>
                  <td>{tx.date.toISOString().slice(0, 10)}</td>
                  <td>{tx.categoryName}</td>
                  <td>{tx.accountName}</td>
                  <td className={tx.direction === "inflow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {tx.direction === "inflow" ? "+" : "-"}
                    {tx.amount.toLocaleString()}
                  </td>
                  <td>{tx.description ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
