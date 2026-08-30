type Rates = { jpy: number | null; idr: number | null };

export function convertAmount(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  if (rates.jpy === null || rates.idr === null) return null;

  const usdPerUnit: Record<string, number> = { JPY: rates.jpy, IDR: rates.idr };
  const fromRate = usdPerUnit[from];
  const toRate = usdPerUnit[to];
  if (fromRate === undefined || toRate === undefined) return null;

  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}
