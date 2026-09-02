import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavTabs } from "@/components/nav-tabs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden="true">💰</span>
              Budget Tracker
            </h1>
            <ThemeToggle />
          </header>
          <NavTabs />
          <main className="p-4">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
