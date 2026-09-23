import { redirect } from "next/navigation";

// Saving Accounts now lives at /savings/jpy and /savings/idr.
// This keeps old links/bookmarks to the bare / path working.
export default async function HomeRedirect({
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
  redirect(`/savings/jpy${qs ? `?${qs}` : ""}`);
}
