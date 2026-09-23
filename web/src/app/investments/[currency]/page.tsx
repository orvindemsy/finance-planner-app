import Link from "next/link";
import { notFound } from "next/navigation";
import { getHoldings, summarizePortfolio } from "@/lib/investments-query";
import { CURRENCY_SYMBOLS } from "@/lib/fx";
import { TH, TH_RIGHT, TD, TD_RIGHT, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { EditableCell } from "@/components/editable-cell";
import { AddHoldingForm } from "@/components/add-holding-form";
import { DeleteHoldingButton } from "@/components/delete-holding-button";
import { updateHoldingFieldAction } from "../actions";

export const dynamic = "force-dynamic";

const CURRENCIES: Record<string, string> = { jpy: "JPY", idr: "IDR" };

const COLUMNS = [
  "Name",
  "Quantity",
  "Buy Price",
  "Current Price",
  "Invested Amount",
  "Current Value",
  "Profit / Loss",
  "Profit / Loss %",
  "",
];

function fmt(symbol: string, n: number) {
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function plClassName(pl: number) {
  return pl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

export default async function InvestmentsPage({ params }: { params: Promise<{ currency: string }> }) {
  const { currency: currencySlug } = await params;
  const dbCurrency = CURRENCIES[currencySlug];
  if (!dbCurrency) notFound();

  const holdings = await getHoldings(dbCurrency);
  const summary = summarizePortfolio(holdings);
  const symbol = CURRENCY_SYMBOLS[dbCurrency] ?? dbCurrency;

  const currencyTab = (slug: string, label: string) => (
    <Link
      key={slug}
      href={`/investments/${slug}`}
      className={
        "px-3 py-1.5 text-sm rounded-lg font-medium " +
        (slug === currencySlug
          ? "bg-blue-600 text-white"
          : "border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50")
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {currencyTab("jpy", "JPY")}
        {currencyTab("idr", "IDR")}
      </div>

      <div className={`${CARD} grid grid-cols-3 gap-4`}>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Invested Amount</div>
          <div className="text-xl font-bold">{fmt(symbol, summary.investedAmount)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
          <div className="text-xl font-bold">{fmt(symbol, summary.currentValue)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Profit / Loss</div>
          <div className={`text-xl font-bold ${plClassName(summary.pl)}`}>
            {summary.pl >= 0 ? "+" : ""}
            {fmt(symbol, summary.pl)}
            {summary.plPercent !== null && (
              <span className="text-sm font-medium ml-1">
                ({summary.plPercent >= 0 ? "+" : ""}
                {summary.plPercent.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <AddHoldingForm currency={dbCurrency} />
      </div>

      <section className={CARD}>
        <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
          {dbCurrency} Portfolio
        </h2>
        <div className={TABLE_SCROLL}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col} className={col === "Name" || col === "" ? TH : TH_RIGHT}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className={`${TD} text-gray-400 dark:text-gray-500`}>
                    No holdings yet.
                  </td>
                </tr>
              ) : (
                holdings.map((h) => (
                  <tr key={h.id} className={TR_HOVER}>
                    <EditableCell
                      value={h.name}
                      displayValue={h.name || "—"}
                      editor={{ kind: "text" }}
                      onSave={updateHoldingFieldAction.bind(null, h.id, "name")}
                      className={TD}
                    />
                    <EditableCell
                      value={String(h.quantity)}
                      displayValue={h.quantity.toLocaleString()}
                      editor={{ kind: "number", min: 0 }}
                      onSave={updateHoldingFieldAction.bind(null, h.id, "quantity")}
                      className={TD_RIGHT}
                    />
                    <EditableCell
                      value={String(h.avgPrice)}
                      displayValue={h.avgPrice.toLocaleString()}
                      editor={{ kind: "number", min: 0 }}
                      onSave={updateHoldingFieldAction.bind(null, h.id, "avgPrice")}
                      className={TD_RIGHT}
                    />
                    <EditableCell
                      value={String(h.marketPrice)}
                      displayValue={h.marketPrice.toLocaleString()}
                      editor={{ kind: "number", min: 0 }}
                      onSave={updateHoldingFieldAction.bind(null, h.id, "marketPrice")}
                      className={TD_RIGHT}
                    />
                    <td className={TD_RIGHT}>{fmt(symbol, h.investedAmount)}</td>
                    <td className={TD_RIGHT}>{fmt(symbol, h.currentValue)}</td>
                    <td className={`${TD_RIGHT} ${plClassName(h.pl)}`}>
                      {h.pl >= 0 ? "+" : ""}
                      {fmt(symbol, h.pl)}
                    </td>
                    <td className={`${TD_RIGHT} ${plClassName(h.pl)}`}>
                      {h.plPercent === null ? "—" : `${h.plPercent >= 0 ? "+" : ""}${h.plPercent.toFixed(2)}%`}
                    </td>
                    <td className={TD}>
                      <DeleteHoldingButton id={h.id} name={h.name} />
                    </td>
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
