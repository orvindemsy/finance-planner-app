import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { parsePeriod } from "@/lib/period";
import { PERIOD_COOKIE } from "@/lib/period-cookie";
import {
  getTransactionsForPeriod,
  getActiveCategories,
  getActiveAccounts,
  getRunningBalances,
} from "@/lib/transactions-query";
import { CURRENCY_SYMBOLS } from "@/lib/fx";
import { TH, TH_RIGHT, TD, TD_RIGHT, TD_NOTES, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { PeriodSelect } from "@/components/period-select";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { AddTransferForm } from "@/components/add-transfer-form";
import { TransactionFilters } from "@/components/transaction-filters";
import { EditableCell } from "@/components/editable-cell";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { CashCounter } from "@/components/cash-counter";
import { updateTransactionFieldAction } from "../actions";
import { HIDE_AMOUNTS_COOKIE } from "@/lib/privacy-cookie";
import { CATEGORY_FILTER_COOKIE, ACCOUNT_FILTER_COOKIE, DIRECTION_FILTER_COOKIE } from "@/lib/transaction-filters-cookie";

export const dynamic = "force-dynamic";

const MASK = "••••";

const CURRENCIES: Record<string, string> = { jpy: "JPY", idr: "IDR" };

const COLUMNS = [
  "Date",
  "Cashflow",
  "Category",
  "Payment Type",
  "Description",
  "Amount",
  "Running Balance",
  "Status",
  "Notes",
  "",
];

const DIRECTION_OPTIONS = [
  { value: "outflow", label: "Outflow" },
  { value: "inflow", label: "Inflow" },
];

const STATUS_OPTIONS = [
  { value: "finalized", label: "Finalized" },
  { value: "pending", label: "Pending" },
];

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ currency: string }>;
  searchParams: Promise<{
    period?: string;
    category?: string;
    account?: string;
    direction?: string;
    sort?: string;
    sortBy?: string;
    search?: string;
  }>;
}) {
  const { currency: currencySlug } = await params;
  const dbCurrency = CURRENCIES[currencySlug];
  if (!dbCurrency) notFound();

  const params_ = await searchParams;
  const cookieStore = await cookies();
  const period = parsePeriod(params_.period ?? cookieStore.get(PERIOD_COOKIE)?.value);
  const hideAmounts = cookieStore.get(HIDE_AMOUNTS_COOKIE)?.value === "1";
  const year = String(period.getUTCFullYear());
  const month = String(period.getUTCMonth() + 1).padStart(2, "0");
  const basePath = `/transactions/${currencySlug}`;

  const today = new Date();
  const isCurrentPeriod = year === String(today.getFullYear()) && month === String(today.getMonth() + 1).padStart(2, "0");
  const defaultDate = isCurrentPeriod
    ? `${year}-${month}-${String(today.getDate()).padStart(2, "0")}`
    : `${year}-${month}-01`;

  const categoryCookie = `${CATEGORY_FILTER_COOKIE}-${currencySlug}`;
  const accountCookie = `${ACCOUNT_FILTER_COOKIE}-${currencySlug}`;
  const directionCookie = `${DIRECTION_FILTER_COOKIE}-${currencySlug}`;

  const categoryParam = params_.category ?? cookieStore.get(categoryCookie)?.value;
  const accountParam = params_.account ?? cookieStore.get(accountCookie)?.value;
  const directionParam = params_.direction ?? cookieStore.get(directionCookie)?.value;

  const categoryId = categoryParam && categoryParam !== "all" ? Number(categoryParam) : undefined;
  const accountId = accountParam && accountParam !== "all" ? Number(accountParam) : undefined;
  const direction = directionParam === "inflow" || directionParam === "outflow" ? directionParam : undefined;
  const sort = params_.sort === "asc" ? "asc" : "desc";
  const sortBy = params_.sortBy === "amount" ? "amount" : "date";
  const search = params_.search ?? "";

  const [transactions, categories, accounts] = await Promise.all([
    getTransactionsForPeriod(period, { categoryId, accountId, direction, sort, sortBy, search, currency: dbCurrency }),
    getActiveCategories(),
    getActiveAccounts(dbCurrency),
  ]);

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: a.name }));

  const visibleAccountIds = [...new Set(transactions.map((tx) => tx.accountId))];
  const runningBalances = await getRunningBalances(visibleAccountIds);

  function sortLink(field: "date" | "amount") {
    const nextDir = sortBy === field && sort === "asc" ? "desc" : "asc";
    const p = new URLSearchParams({ period: `${year}-${month}`, sortBy: field, sort: nextDir });
    if (categoryId) p.set("category", String(categoryId));
    if (accountId) p.set("account", String(accountId));
    if (direction) p.set("direction", direction);
    if (search) p.set("search", search);
    return `${basePath}?${p.toString()}`;
  }

  const periodStr = `${year}-${month}`;
  const currencyTab = (slug: string, label: string) => (
    <Link
      key={slug}
      href={`/transactions/${slug}?period=${periodStr}`}
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

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PeriodSelect year={year} month={month} basePath={basePath} />
          <PrivacyToggle hidden={hideAmounts} />
        </div>
        <div className="flex items-center gap-2">
          {currencySlug === "jpy" && <CashCounter />}
          <AddTransferForm accounts={accounts} />
          <AddTransactionForm
            defaultDate={defaultDate}
            defaultCategoryId={categories[0]?.id}
            defaultAccountId={accounts[0]?.id}
          />
        </div>
      </div>

      <TransactionFilters
        currencySlug={currencySlug}
        year={year}
        month={month}
        categoryId={categoryId ? String(categoryId) : "all"}
        accountId={accountId ? String(accountId) : "all"}
        direction={direction ?? "all"}
        search={search}
        categories={categories}
        accounts={accounts}
      />

      <section className={CARD}>
        <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
          {dbCurrency} Transactions
        </h2>
        <div className={TABLE_SCROLL}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {COLUMNS.map((col) =>
                  col === "Date" ? (
                    <th key={col} className={TH}>
                      <Link href={sortLink("date")} className="hover:underline">
                        Date {sortBy === "date" ? (sort === "asc" ? "▲" : "▼") : ""}
                      </Link>
                    </th>
                  ) : col === "Amount" ? (
                    <th key={col} className={TH_RIGHT}>
                      <Link href={sortLink("amount")} className="hover:underline">
                        Amount {sortBy === "amount" ? (sort === "asc" ? "▲" : "▼") : ""}
                      </Link>
                    </th>
                  ) : (
                    <th key={col} className={col === "Running Balance" ? TH_RIGHT : TH}>
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className={`${TD} text-gray-400 dark:text-gray-500`}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const amountClassName = `${TD_RIGHT} ${tx.direction === "inflow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`;
                  return (
                    <tr key={tx.id} className={TR_HOVER}>
                      <EditableCell
                        value={tx.date.toISOString().slice(0, 10)}
                        displayValue={tx.date.toISOString().slice(0, 10)}
                        editor={{ kind: "date" }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "date")}
                      />
                      <EditableCell
                        value={tx.direction}
                        displayValue={tx.direction === "inflow" ? "Inflow" : "Outflow"}
                        editor={{ kind: "select", options: DIRECTION_OPTIONS }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "direction")}
                      />
                      <EditableCell
                        value={String(tx.categoryId)}
                        displayValue={tx.categoryName}
                        editor={{ kind: "select", options: categoryOptions }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "categoryId")}
                      />
                      <EditableCell
                        value={String(tx.accountId)}
                        displayValue={tx.accountName}
                        editor={{ kind: "select", options: accountOptions }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "accountId")}
                      />
                      <EditableCell
                        value={tx.description ?? ""}
                        displayValue={tx.description ?? ""}
                        editor={{ kind: "text" }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "description")}
                      />
                      <EditableCell
                        value={String(tx.amount)}
                        displayValue={
                          hideAmounts && tx.direction === "inflow" ? (
                            MASK
                          ) : (
                            <>
                              {tx.direction === "inflow" ? "+" : "-"}
                              {CURRENCY_SYMBOLS[tx.currency] ?? tx.currency}
                              {tx.amount.toLocaleString()}
                            </>
                          )
                        }
                        editor={{ kind: "number", min: 0 }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "amount")}
                        className={amountClassName}
                      />
                      <td className={TD_RIGHT} title={`${tx.accountName} balance after this transaction`}>
                        {(() => {
                          if (hideAmounts) return MASK;
                          const balance = runningBalances.get(tx.id);
                          if (balance === undefined) return "—";
                          const symbol = CURRENCY_SYMBOLS[tx.currency] ?? tx.currency;
                          return `${symbol}${balance.toLocaleString()}`;
                        })()}
                      </td>
                      <EditableCell
                        value={tx.status}
                        displayValue={tx.status === "finalized" ? "Finalized" : "Pending"}
                        editor={{ kind: "select", options: STATUS_OPTIONS }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "status")}
                      />
                      <EditableCell
                        value={tx.notes ?? ""}
                        displayValue={tx.notes ?? ""}
                        editor={{ kind: "text" }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "notes")}
                        className={TD_NOTES}
                      />
                      <td className={TD}>
                        <DeleteTransactionButton id={tx.id} description={tx.description} notes={tx.notes} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
