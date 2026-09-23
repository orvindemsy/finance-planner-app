import Link from "next/link";
import { CURRENCY_SYMBOLS } from "@/lib/fx";

export function InvestmentSummaryCard({
  label,
  currency,
  investedAmount,
  currentValue,
  pl,
  plPercent,
  href,
  hidden = false,
}: {
  label: string;
  currency: string;
  investedAmount: number;
  currentValue: number;
  pl: number;
  plPercent: number | null;
  href: string;
  hidden?: boolean;
}) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const plClassName = pl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <Link href={href} className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold">
        {hidden ? "••••••" : `${symbol}${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </div>
      <div className={`text-xs ${hidden ? "text-gray-400 dark:text-gray-500" : plClassName}`}>
        {hidden ? (
          "•••• profit/loss"
        ) : (
          <>
            {pl >= 0 ? "+" : ""}
            {symbol}
            {pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {plPercent !== null && ` (${plPercent >= 0 ? "+" : ""}${plPercent.toFixed(2)}%)`} vs invested{" "}
            {hidden ? "" : `${symbol}${investedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </>
        )}
      </div>
    </Link>
  );
}
