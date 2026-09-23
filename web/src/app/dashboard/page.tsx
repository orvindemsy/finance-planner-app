import { redirect } from "next/navigation";

// The Dashboard now lives at /dashboard/jpy and /dashboard/idr.
export default async function DashboardRedirect() {
  redirect("/dashboard/jpy");
}
