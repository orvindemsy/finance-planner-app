import { CURRENCY_SYMBOLS } from "@/lib/fx";
import { EditableCell } from "@/components/editable-cell";
import { updateMonthlyExpenseAction, updateWithdrawalRateAction } from "@/app/actions";

const MASK = "••••";

export function FireDashboardCard({
  currencySlug,
  currency,
  netWorth,
  monthlyExpense,
  withdrawalRate,
  fireTarget,
  hidden = false,
}: {
  currencySlug: string;
  currency: string;
  netWorth: number | null;
  monthlyExpense: number | null;
  withdrawalRate: number;
  fireTarget: number | null;
  hidden?: boolean;
}) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const progressPct =
    netWorth !== null && fireTarget !== null && fireTarget > 0 ? (netWorth / fireTarget) * 100 : null;
  const barWidth = progressPct === null ? 0 : Math.min(100, Math.max(0, progressPct));

  function fmt(n: number) {
    return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">FIRE Progress</div>
          {progressPct !== null && !hidden && (
            <div className="text-sm font-semibold">{progressPct.toFixed(1)}%</div>
          )}
        </div>

        <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
            style={{ width: `${hidden ? 0 : barWidth}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Net worth: {hidden ? MASK : netWorth !== null ? fmt(netWorth) : "—"}</span>
          <span>Target: {hidden ? MASK : fireTarget !== null ? fmt(fireTarget) : "—"}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Estimated Monthly Expense</div>
          {hidden ? (
            <div className="px-1 py-0.5 text-sm">{MASK}</div>
          ) : (
            <EditableCell
              as="span"
              value={monthlyExpense !== null ? String(monthlyExpense) : "0"}
              displayValue={monthlyExpense !== null ? fmt(monthlyExpense) : "Set expense"}
              editor={{ kind: "number", min: 0 }}
              onSave={updateMonthlyExpenseAction.bind(null, currencySlug)}
              className="block px-1 py-0.5 hover:underline text-sm"
            />
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Withdrawal Rate</div>
          {hidden ? (
            <div className="px-1 py-0.5 text-sm">{MASK}</div>
          ) : (
            <EditableCell
              as="span"
              value={String(withdrawalRate)}
              displayValue={`${withdrawalRate}%`}
              editor={{ kind: "number", min: 0.1 }}
              onSave={updateWithdrawalRateAction}
              className="block px-1 py-0.5 hover:underline text-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
