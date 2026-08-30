const FX_API_URL = "https://api.frankfurter.dev/v1/latest";
const CACHE_TTL_MS = 60 * 60 * 1000;

export const CURRENCY_SYMBOLS: Record<string, string> = { JPY: "¥", IDR: "Rp", USD: "$" };

type RatesCache = {
  rates: Record<string, number> | null;
  fetchedAt: number | null;
  error: string | null;
};

const cache: RatesCache = { rates: null, fetchedAt: null, error: null };

export async function getUsdRates() {
  const now = Date.now();
  if (cache.rates === null || now - (cache.fetchedAt ?? 0) >= CACHE_TTL_MS) {
    try {
      const url = new URL(FX_API_URL);
      url.searchParams.set("base", "USD");
      url.searchParams.set("symbols", "JPY,IDR");
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`FX API returned ${response.status}`);
      const body = await response.json();
      cache.rates = body.rates ?? {};
      cache.fetchedAt = now;
      cache.error = null;
    } catch (err) {
      cache.error = err instanceof Error ? err.message : String(err);
    }
  }

  const rates = cache.rates ?? {};
  return {
    jpy: rates.JPY ?? null,
    idr: rates.IDR ?? null,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    error: cache.error,
  };
}
