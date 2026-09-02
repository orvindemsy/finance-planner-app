import { getAllAccounts } from "@/lib/accounts-query";
import { CURRENCY_SYMBOLS } from "@/lib/fx";
import { TH, TH_RIGHT, TD, TD_RIGHT, TR_HOVER, CARD, TABLE_SCROLL } from "@/lib/table-styles";
import { EditableCell } from "@/components/editable-cell";
import { AddAccountForm } from "@/components/add-account-form";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { updateStartingBalanceAction } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS = ["Account", "Currency", "Starting Balance", "Current Balance", ""];

export default async function AccountsPage() {
  const accounts = await getAllAccounts();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AddAccountForm />
      </div>

      <section className={CARD}>
        <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">Accounts</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Starting balance is what the account held before its transaction history began. Click a value to edit it.
        </p>
        <div className={TABLE_SCROLL}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {COLUMNS.map((col, i) => (
                  <th key={col || i} className={col.includes("Balance") ? TH_RIGHT : TH}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className={`${TD} text-gray-400 dark:text-gray-500`}>
                    No accounts yet.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => {
                  const symbol = CURRENCY_SYMBOLS[a.currency] ?? a.currency;
                  return (
                    <tr key={a.id} className={TR_HOVER}>
                      <td className={TD}>{a.name}</td>
                      <td className={TD}>{a.currency}</td>
                      <EditableCell
                        value={String(a.startingBalance)}
                        displayValue={`${symbol}${a.startingBalance.toLocaleString()}`}
                        editor={{ kind: "number" }}
                        onSave={updateStartingBalanceAction.bind(null, a.id)}
                        className={TD_RIGHT}
                      />
                      <td className={TD_RIGHT}>
                        {symbol}
                        {a.currentBalance.toLocaleString()}
                      </td>
                      <td className={TD}>
                        <DeleteAccountButton id={a.id} name={a.name} />
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
