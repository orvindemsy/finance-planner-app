import { CURRENCY_SYMBOLS } from "@/lib/fx";

export function BalanceCard({
  label,
  nativeCurrency,
  nativeAmount,
  displayCurrency,
  displayAmount,
}: {
  label: string;
  nativeCurrency: string;
  nativeAmount: number;
  displayCurrency: string;
  displayAmount: number | null;
}) {
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
  const nativeSymbol = CURRENCY_SYMBOLS[nativeCurrency] ?? nativeCurrency;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold">
        {displayAmount === null ? "—" : `${symbol}${displayAmount.toLocaleString()}`}
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {nativeSymbol}
        {nativeAmount.toLocaleString()} native
      </div>
    </div>
  );
}
