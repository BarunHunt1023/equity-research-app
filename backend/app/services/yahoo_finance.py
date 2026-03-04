import time
import threading
from functools import lru_cache

import yfinance as yf
import pandas as pd
import numpy as np


# Simple rate limiter: track last request time, enforce minimum gap
_rate_lock = threading.Lock()
_last_request_time = 0.0
_MIN_REQUEST_GAP = 2.5  # seconds between Yahoo Finance requests


def _rate_limit():
    """Enforce minimum gap between Yahoo Finance requests."""
    global _last_request_time
    with _rate_lock:
        now = time.time()
        elapsed = now - _last_request_time
        if elapsed < _MIN_REQUEST_GAP:
            time.sleep(_MIN_REQUEST_GAP - elapsed)
        _last_request_time = time.time()


# Simple in-memory cache: {key: (timestamp, data)}
_cache = {}
_CACHE_TTL = 3600  # 1 hour


def _cache_get(key):
    """Get from cache if not expired."""
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _cache_set(key, data):
    """Store in cache."""
    _cache[key] = (time.time(), data)


def _retry(fn, retries=3):
    """Retry a function with longer backoff to respect rate limits."""
    last_err = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(3 + attempt * 5)  # 3s, 8s, 13s
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
    cache_key = f"info:{ticker}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
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

    result = _retry(_fetch)
    _cache_set(cache_key, result)
    return result


def get_financials(ticker: str) -> dict:
    cache_key = f"financials:{ticker}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
        return {
            "income_statement": _df_to_dict(t.financials),
            "balance_sheet": _df_to_dict(t.balance_sheet),
            "cash_flow": _df_to_dict(t.cashflow),
        }

    result = _retry(_fetch)
    _cache_set(cache_key, result)
    return result


def get_historical_prices(ticker: str, period: str = "5y") -> list[dict]:
    cache_key = f"prices:{ticker}:{period}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    _rate_limit()
    t = yf.Ticker(ticker)
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
    _cache_set(cache_key, records)
    return records


def get_risk_free_rate() -> float:
    """Fetch 10-Year Treasury yield as risk-free rate proxy."""
    cached = _cache_get("risk_free_rate")
    if cached:
        return cached
    try:
        _rate_limit()
        tnx = yf.Ticker("^TNX")
        hist = tnx.history(period="5d")
        if not hist.empty:
            rate = float(hist["Close"].iloc[-1]) / 100.0
            _cache_set("risk_free_rate", rate)
            return rate
    except Exception:
        pass
    return 0.043  # fallback


def get_peer_tickers(ticker: str, max_peers: int = 5) -> list[str]:
    """Find peer companies in the same sector/industry."""
    # This reuses get_company_info which is cached
    info = get_company_info(ticker)
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
            _rate_limit()
            info = yf.Ticker(t).info or {}
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
        except Exception:
            continue
    return results
