export function FxRateCard({ label, value, symbol }: { label: string; value: number | null; symbol: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>{" "}
      {value === null ? (
        <span className="text-gray-400">unavailable</span>
      ) : (
        <span>
          {symbol}
          {value.toLocaleString()}
        </span>
      )}
    </div>
  );
}
