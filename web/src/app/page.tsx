import { parsePeriod } from "@/lib/period";
import {
  getBalancesByCurrency,
  getCategoryBreakdown,
  getPeriodTotals,
  getRecentTransactions,
} from "@/lib/dashboard-queries";
import { getUsdRates, CURRENCY_SYMBOLS } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";
import { PeriodSelect } from "@/components/period-select";
import { BalanceCard } from "@/components/balance-card";
import { FxRateCard } from "@/components/fx-rate-card";
import { TH, TH_RIGHT, TD, TD_RIGHT, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { EditableCell } from "@/components/editable-cell";
import { updateBudgetAction } from "./actions";

const DEFAULT_CURRENCY = "JPY";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const period = parsePeriod(params.period);
  const year = String(period.getUTCFullYear());
  const month = String(period.getUTCMonth() + 1).padStart(2, "0");
  const periodStr = `${year}-${month}`;

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
      <div className="grid grid-cols-2 gap-4 items-center">
        <PeriodSelect year={year} month={month} currency={currency} />

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
        />
        <BalanceCard
          label="IDR Account"
          nativeCurrency="IDR"
          nativeAmount={balances.IDR ?? 0}
          displayCurrency={currency}
          displayAmount={convertAmount(balances.IDR ?? 0, "IDR", currency, fx)}
        />
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

      <div className="grid grid-cols-2 gap-4">
        <section className={CARD}>
          <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">Spending</h2>
          <div className={TABLE_SCROLL}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Category</th>
                  <th className={TH_RIGHT}>Budget</th>
                  <th className={TH_RIGHT}>Actual</th>
                  <th className={TH_RIGHT}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.expense.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${TD} text-gray-400 dark:text-gray-500`}>
                      No expense categories yet.
                    </td>
                  </tr>
                ) : (
                  breakdown.expense.map((row) => (
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
                  <th className={TH}>Category</th>
                  <th className={TH_RIGHT}>Budget</th>
                  <th className={TH_RIGHT}>Actual</th>
                  <th className={TH_RIGHT}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.income.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${TD} text-gray-400 dark:text-gray-500`}>
                      No income categories yet.
                    </td>
                  </tr>
                ) : (
                  breakdown.income.map((row) => (
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
                      <td className={`${TD_RIGHT} ${row.actual >= row.budget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {(row.actual - row.budget).toLocaleString()}
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
                      {tx.direction === "inflow" ? "+" : "-"}
                      {tx.amount.toLocaleString()}
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
