import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { parsePeriod } from "@/lib/period";
import { getBalancesByCurrency } from "@/lib/dashboard-queries";
import { getHoldings, summarizePortfolio } from "@/lib/investments-query";
import { getMonthlyExpense, getWithdrawalRate } from "@/lib/settings-query";
import { getUsdRates, CURRENCY_SYMBOLS } from "@/lib/fx";
import { convertAmount } from "@/lib/convert";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { FireDashboardCard } from "@/components/fire-dashboard-card";
import { HIDE_AMOUNTS_COOKIE } from "@/lib/privacy-cookie";

const MASK = "••••";

const CURRENCIES: Record<string, string> = { jpy: "JPY", idr: "IDR" };

function fmt(symbol: string, n: number) {
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage({ params }: { params: Promise<{ currency: string }> }) {
  const { currency: currencySlug } = await params;
  const currency = CURRENCIES[currencySlug];
  if (!currency) notFound();

  const cookieStore = await cookies();
  const hideAmounts = cookieStore.get(HIDE_AMOUNTS_COOKIE)?.value === "1";
  const period = parsePeriod(undefined);

  const [balances, jpyHoldings, idrHoldings, monthlyExpenseJpy, withdrawalRate, fx] = await Promise.all([
    getBalancesByCurrency(period),
    getHoldings("JPY"),
    getHoldings("IDR"),
    getMonthlyExpense(),
    getWithdrawalRate(),
    getUsdRates(),
  ]);

  const jpyPortfolio = summarizePortfolio(jpyHoldings);
  const idrPortfolio = summarizePortfolio(idrHoldings);

  const jpySavingsNative = balances.JPY ?? 0;
  const idrSavingsNative = balances.IDR ?? 0;
  const jpySavingsConverted = convertAmount(jpySavingsNative, "JPY", currency, fx);
  const idrSavingsConverted = convertAmount(idrSavingsNative, "IDR", currency, fx);
  const totalSavings =
    jpySavingsConverted !== null && idrSavingsConverted !== null ? jpySavingsConverted + idrSavingsConverted : null;

  const jpyInvestmentConverted = convertAmount(jpyPortfolio.currentValue, "JPY", currency, fx);
  const idrInvestmentConverted = convertAmount(idrPortfolio.currentValue, "IDR", currency, fx);
  const totalInvestment =
    jpyInvestmentConverted !== null && idrInvestmentConverted !== null
      ? jpyInvestmentConverted + idrInvestmentConverted
      : null;

  const netWorth = totalSavings !== null && totalInvestment !== null ? totalSavings + totalInvestment : null;

  const monthlyExpenseDisplay = convertAmount(monthlyExpenseJpy, "JPY", currency, fx);
  const fireTargetJpy = (monthlyExpenseJpy * 12 * 100) / withdrawalRate;
  const fireTargetDisplay = convertAmount(fireTargetJpy, "JPY", currency, fx);

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  const currencyTab = (slug: string, label: string) => (
    <Link
      key={slug}
      href={`/dashboard/${slug}`}
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {currencyTab("jpy", "JPY")}
          {currencyTab("idr", "IDR")}
        </div>
        <PrivacyToggle hidden={hideAmounts} />
      </div>

      <FireDashboardCard
        currencySlug={currencySlug}
        currency={currency}
        netWorth={netWorth}
        monthlyExpense={monthlyExpenseDisplay}
        withdrawalRate={withdrawalRate}
        fireTarget={fireTargetDisplay}
        hidden={hideAmounts}
      />

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">Total Assets ({currency})</div>
        <div className="text-3xl font-bold">{hideAmounts ? MASK : netWorth !== null ? fmt(symbol, netWorth) : "—"}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Saving Accounts</div>
          <div className="text-2xl font-bold">
            {hideAmounts ? MASK : totalSavings !== null ? fmt(symbol, totalSavings) : "—"}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>JPY</span>
              <span>{hideAmounts ? MASK : fmt("¥", jpySavingsNative)}</span>
            </div>
            <div className="flex justify-between">
              <span>IDR</span>
              <span>{hideAmounts ? MASK : fmt("Rp", idrSavingsNative)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Investment</div>
          <div className="text-2xl font-bold">
            {hideAmounts ? MASK : totalInvestment !== null ? fmt(symbol, totalInvestment) : "—"}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>JPY</span>
              <span>{hideAmounts ? MASK : fmt("¥", jpyPortfolio.currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>IDR</span>
              <span>{hideAmounts ? MASK : fmt("Rp", idrPortfolio.currentValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
