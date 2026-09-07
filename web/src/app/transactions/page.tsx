import { redirect } from "next/navigation";

// The Transactions page now lives at /transactions/jpy and /transactions/idr.
// This keeps old links/bookmarks to the bare /transactions path working.
export default async function TransactionsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/transactions/jpy${qs ? `?${qs}` : ""}`);
}
