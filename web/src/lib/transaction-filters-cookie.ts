// Shared cookie names for the last-selected Transactions filters (Category,
// Payment Type, Cashflow), so they survive switching to another tab and back
// — read server-side as a fallback default whenever the URL doesn't already
// specify the filter, written client-side by TransactionFilters whenever the
// user changes one.
export const CATEGORY_FILTER_COOKIE = "txCategory";
export const ACCOUNT_FILTER_COOKIE = "txAccount";
export const DIRECTION_FILTER_COOKIE = "txDirection";
