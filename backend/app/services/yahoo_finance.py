import time
import json

import yfinance as yf
import pandas as pd
import numpy as np
from requests import Session
from requests_cache import CacheMixin, SQLiteCache
from requests_ratelimiter import LimiterMixin, MemoryQueueBucket
from pyrate_limiter import Duration, RequestRate, Limiter


class CachedLimiterSession(CacheMixin, LimiterMixin, Session):
    """Session that caches responses and rate-limits requests."""
    pass


# Module-level singleton: max 2 requests per 5 seconds, cache for 1 hour
_session = CachedLimiterSession(
    limiter=Limiter(RequestRate(2, Duration.SECOND * 5)),
    bucket_class=MemoryQueueBucket,
    backend=SQLiteCache("/tmp/yfinance.cache", expire_after=3600),
)
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
})


def _retry(fn, retries=3):
    """Retry a function with longer backoff to respect rate limits."""
    last_err = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(2 + attempt * 4)  # 2s, 6s, 10s
    raise last_err


def _safe_val(v):
    """Convert numpy/pandas types to Python native types for JSON serialization."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _df_to_dict(df: pd.DataFrame) -> dict:
    """Convert a yfinance financial DataFrame to a JSON-friendly dict.
    Columns are dates (as ISO strings), rows are line items.
    """
    if df is None or df.empty:
        return {}
    result = {}
    for col in df.columns:
        date_key = col.isoformat() if isinstance(col, pd.Timestamp) else str(col)
        result[date_key] = {
            str(idx): _safe_val(df.at[idx, col]) for idx in df.index
        }
    return result


def get_company_info(ticker: str) -> dict:
    def _fetch():
        t = yf.Ticker(ticker, session=_session)
        info = t.info or {}
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName", ticker.upper()),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "country": info.get("country", "N/A"),
            "market_cap": _safe_val(info.get("marketCap")),
            "enterprise_value": _safe_val(info.get("enterpriseValue")),
            "current_price": _safe_val(info.get("currentPrice") or info.get("regularMarketPrice")),
            "currency": info.get("currency", "USD"),
            "shares_outstanding": _safe_val(info.get("sharesOutstanding")),
            "beta": _safe_val(info.get("beta")),
            "trailing_pe": _safe_val(info.get("trailingPE")),
            "forward_pe": _safe_val(info.get("forwardPE")),
            "dividend_yield": _safe_val(info.get("dividendYield")),
            "fifty_two_week_high": _safe_val(info.get("fiftyTwoWeekHigh")),
            "fifty_two_week_low": _safe_val(info.get("fiftyTwoWeekLow")),
            "description": info.get("longBusinessSummary", ""),
        }
    return _retry(_fetch)


def get_financials(ticker: str) -> dict:
    def _fetch():
        t = yf.Ticker(ticker, session=_session)
        return {
            "income_statement": _df_to_dict(t.financials),
            "balance_sheet": _df_to_dict(t.balance_sheet),
            "cash_flow": _df_to_dict(t.cashflow),
        }
    return _retry(_fetch)


def get_historical_prices(ticker: str, period: str = "5y") -> list[dict]:
    t = yf.Ticker(ticker, session=_session)
    hist = t.history(period=period)
    if hist.empty:
        return []
    records = []
    for date, row in hist.iterrows():
        records.append({
            "date": date.isoformat(),
            "open": _safe_val(row.get("Open")),
            "high": _safe_val(row.get("High")),
            "low": _safe_val(row.get("Low")),
            "close": _safe_val(row.get("Close")),
            "volume": _safe_val(row.get("Volume")),
        })
    return records


def get_risk_free_rate() -> float:
    """Fetch 10-Year Treasury yield as risk-free rate proxy."""
    try:
        tnx = yf.Ticker("^TNX", session=_session)
        hist = tnx.history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1]) / 100.0
    except Exception:
        pass
    return 0.043  # fallback


def get_peer_tickers(ticker: str, max_peers: int = 5) -> list[str]:
    """Find peer companies in the same sector/industry."""
    t = yf.Ticker(ticker, session=_session)
    info = t.info or {}
    sector = info.get("sector", "")

    # Use a curated mapping for common sectors as yfinance doesn't have a peer API
    sector_peers = {
        "Technology": ["AAPL", "MSFT", "GOOGL", "META", "AMZN", "NVDA", "CRM", "ADBE", "ORCL", "INTC"],
        "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC", "C", "BLK", "SCHW", "AXP", "USB"],
        "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY", "BMY", "AMGN"],
        "Consumer Cyclical": ["AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "TJX", "BKNG"],
        "Consumer Defensive": ["PG", "KO", "PEP", "WMT", "COST", "MDLZ", "CL", "EL", "GIS", "KHC"],
        "Communication Services": ["GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA"],
        "Industrials": ["HON", "UPS", "CAT", "BA", "GE", "MMM", "RTX", "LMT", "DE", "UNP"],
        "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL"],
        "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "SPG", "O", "PSA", "DLR", "WELL", "AVB"],
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "WEC", "ED"],
        "Basic Materials": ["LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "DD", "DOW", "PPG"],
    }

    candidates = sector_peers.get(sector, [])
    upper_ticker = ticker.upper()
    peers = [p for p in candidates if p != upper_ticker][:max_peers]
    return peers


def get_peer_data(tickers: list[str]) -> list[dict]:
    """Fetch key metrics for a list of peer tickers."""
    results = []
    for t in tickers:
        try:
            info = yf.Ticker(t, session=_session).info or {}
            results.append({
                "ticker": t,
                "name": info.get("longName") or info.get("shortName", t),
                "market_cap": _safe_val(info.get("marketCap")),
                "enterprise_value": _safe_val(info.get("enterpriseValue")),
                "trailing_pe": _safe_val(info.get("trailingPE")),
                "forward_pe": _safe_val(info.get("forwardPE")),
                "price_to_book": _safe_val(info.get("priceToBook")),
                "price_to_sales": _safe_val(info.get("priceToSalesTrailing12Months")),
                "ev_to_ebitda": _safe_val(info.get("enterpriseToEbitda")),
                "ev_to_revenue": _safe_val(info.get("enterpriseToRevenue")),
                "profit_margin": _safe_val(info.get("profitMargins")),
                "revenue": _safe_val(info.get("totalRevenue")),
                "ebitda": _safe_val(info.get("ebitda")),
            })
            time.sleep(1)  # gentle delay between peer fetches
        except Exception:
            continue
    return results
