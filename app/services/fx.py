import datetime as dt
import time
from typing import Optional

import httpx

FX_API_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_TTL_SECONDS = 3600

CURRENCY_SYMBOLS = {"JPY": "¥", "IDR": "Rp", "USD": "$"}

_cache: dict = {"rates": None, "fetched_at": None, "error": None}


def get_usd_rates() -> dict:
    """Return {jpy, idr, fetched_at, error}, refetching at most once per hour.

    Stale rates are kept and returned (with the new error attached) if a
    refetch fails, so a network blip doesn't blank out the dashboard.
    """
    now = time.time()
    if _cache["rates"] is None or now - (_cache["fetched_at"] or 0) >= CACHE_TTL_SECONDS:
        try:
            response = httpx.get(FX_API_URL, params={"base": "USD", "symbols": "JPY,IDR"}, timeout=5.0)
            response.raise_for_status()
            _cache["rates"] = response.json().get("rates", {})
            _cache["fetched_at"] = now
            _cache["error"] = None
        except (httpx.HTTPError, ValueError) as exc:
            _cache["error"] = str(exc)

    rates = _cache["rates"] or {}
    fetched_at: Optional[float] = _cache["fetched_at"]
    return {
        "jpy": rates.get("JPY"),
        "idr": rates.get("IDR"),
        "fetched_at": dt.datetime.fromtimestamp(fetched_at).strftime("%Y-%m-%d %H:%M") if fetched_at else None,
        "error": _cache["error"],
    }
