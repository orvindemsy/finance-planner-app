import Link from "next/link";
import { parsePeriod } from "@/lib/period";
import { getTransactionsForPeriod, getActiveCategories, getActiveAccounts } from "@/lib/transactions-query";
import { CURRENCY_SYMBOLS } from "@/lib/fx";
import { TH, TH_RIGHT, TD, TD_RIGHT, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { PeriodSelect } from "@/components/period-select";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { TransactionFilters } from "@/components/transaction-filters";
import { EditableCell } from "@/components/editable-cell";
import { updateTransactionFieldAction } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS = ["Date", "Cashflow", "Category", "Payment Type", "Description", "Amount", "Status", "Notes"];

const DIRECTION_OPTIONS = [
  { value: "outflow", label: "Outflow" },
  { value: "inflow", label: "Inflow" },
];

const STATUS_OPTIONS = [
  { value: "finalized", label: "Finalized" },
  { value: "pending", label: "Pending" },
];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    category?: string;
    account?: string;
    direction?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const year = String(period.getUTCFullYear());
  const month = String(period.getUTCMonth() + 1).padStart(2, "0");

  const categoryId = params.category && params.category !== "all" ? Number(params.category) : undefined;
  const accountId = params.account && params.account !== "all" ? Number(params.account) : undefined;
  const direction = params.direction === "inflow" || params.direction === "outflow" ? params.direction : undefined;
  const sort = params.sort === "asc" ? "asc" : "desc";

  const [transactions, categories, accounts] = await Promise.all([
    getTransactionsForPeriod(period, { categoryId, accountId, direction, sort }),
    getActiveCategories(),
    getActiveAccounts(),
  ]);

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: a.name }));

  const sortLinkParams = new URLSearchParams({ period: `${year}-${month}`, sort: sort === "asc" ? "desc" : "asc" });
  if (categoryId) sortLinkParams.set("category", String(categoryId));
  if (accountId) sortLinkParams.set("account", String(accountId));
  if (direction) sortLinkParams.set("direction", direction);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PeriodSelect year={year} month={month} basePath="/transactions" />
        <AddTransactionForm categories={categories} accounts={accounts} />
      </div>

      <TransactionFilters
        year={year}
        month={month}
        categoryId={categoryId ? String(categoryId) : "all"}
        accountId={accountId ? String(accountId) : "all"}
        direction={direction ?? "all"}
        categories={categories}
        accounts={accounts}
      />

      <section className={CARD}>
        <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
          Transactions
        </h2>
        <div className={TABLE_SCROLL}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {COLUMNS.map((col) =>
                  col === "Date" ? (
                    <th key={col} className={TH}>
                      <Link href={`/transactions?${sortLinkParams.toString()}`} className="hover:underline">
                        Date {sort === "asc" ? "▲" : "▼"}
                      </Link>
                    </th>
                  ) : (
                    <th key={col} className={col === "Amount" ? TH_RIGHT : TH}>
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
                          <>
                            {tx.direction === "inflow" ? "+" : "-"}
                            {CURRENCY_SYMBOLS[tx.currency] ?? tx.currency}
                            {tx.amount.toLocaleString()}
                          </>
                        }
                        editor={{ kind: "number", min: 0 }}
                        onSave={updateTransactionFieldAction.bind(null, tx.id, "amount")}
                        className={amountClassName}
                      />
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
                      />
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
