"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/jpy", label: "Dashboard" },
  { href: "/savings/jpy", label: "Saving Accounts" },
  { href: "/transactions/jpy", label: "Transactions" },
  { href: "/investments/jpy", label: "Investment" },
  { href: "/accounts", label: "Accounts" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 px-4 border-b border-gray-200 dark:border-gray-700">
      {TABS.map((tab) => {
        const isActive =
          tab.label === "Dashboard"
            ? pathname.startsWith("/dashboard")
            : tab.label === "Saving Accounts"
              ? pathname === "/" || pathname.startsWith("/savings")
              : tab.label === "Transactions"
                ? pathname.startsWith("/transactions")
                : tab.label === "Investment"
                  ? pathname.startsWith("/investments")
                  : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "py-2 text-sm border-b-2 -mb-px " +
              (isActive
                ? "border-blue-500 dark:border-blue-400 font-semibold"
                : "border-transparent text-gray-500 dark:text-gray-400")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
