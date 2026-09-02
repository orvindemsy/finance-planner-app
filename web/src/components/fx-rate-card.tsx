import Link from "next/link";

export function FxRateCard({
  label,
  value,
  symbol,
  currency,
  isActive,
  href,
}: {
  label: string;
  value: number | null;
  symbol: string;
  currency: string;
  isActive: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-lg border p-3 text-sm " +
        (isActive
          ? "border-blue-500 dark:border-blue-400 font-semibold"
          : "border-gray-200 dark:border-gray-700")
      }
      aria-current={isActive ? "true" : undefined}
      aria-label={`Switch to ${currency}`}
    >
      <span className="text-gray-500 dark:text-gray-400">{label}</span>{" "}
      {value === null ? (
        <span className="text-gray-400">unavailable</span>
      ) : (
        <span>
          {symbol}
          {value.toLocaleString()}
        </span>
      )}
    </Link>
  );
}
