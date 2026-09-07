import { CURRENCY_SYMBOLS } from "@/lib/fx";

export function BalanceCard({
  label,
  nativeCurrency,
  nativeAmount,
  displayCurrency,
  displayAmount,
  asOfLabel,
  hidden = false,
  breakdown,
}: {
  label: string;
  nativeCurrency: string;
  nativeAmount: number;
  displayCurrency: string;
  displayAmount: number | null;
  asOfLabel: string;
  hidden?: boolean;
  breakdown?: { name: string; balance: number }[];
}) {
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
  const nativeSymbol = CURRENCY_SYMBOLS[nativeCurrency] ?? nativeCurrency;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {label} <span className="text-xs">(as of {asOfLabel})</span>
      </div>
      <div className="text-2xl font-bold">
        {hidden
          ? "••••••"
          : displayAmount === null
            ? "—"
            : `${symbol}${displayAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {hidden ? (
          "•••• native"
        ) : (
          <>
            {nativeSymbol}
            {nativeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} native
          </>
        )}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          {breakdown.map((b) => (
            <div key={b.name} className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{b.name}</span>
              <span>
                {hidden ? "••••" : `${nativeSymbol}${b.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
