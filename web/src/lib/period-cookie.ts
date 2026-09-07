// Shared cookie name for the last-selected Year/Month period, so the
// Dashboard and Transactions pages stay in sync and remember the selection
// across tab switches — read server-side as a fallback default whenever the
// URL doesn't already specify a `period`, written client-side by PeriodSelect
// whenever the user changes it.
export const PERIOD_COOKIE = "period";
