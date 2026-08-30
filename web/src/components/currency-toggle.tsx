import Link from "next/link";

export function CurrencyToggle({ currency, period }: { currency: string; period: string }) {
  const currencies = ["JPY", "IDR"];
  return (
    <div className="flex gap-2 text-sm">
      {currencies.map((c) => (
        <Link
          key={c}
          href={`/?period=${period}&currency=${c}`}
          className={c === currency ? "font-bold underline" : "text-gray-500 dark:text-gray-400"}
        >
          {c}
        </Link>
      ))}
    </div>
  );
}
