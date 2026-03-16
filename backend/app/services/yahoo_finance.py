import time
import threading
from functools import lru_cache

import yfinance as yf
import pandas as pd
import numpy as np

try:
    from yfinance.exceptions import YFRateLimitError as _YFRateLimitError
except ImportError:
    _YFRateLimitError = None


def _is_yf_rate_limit(e: Exception) -> bool:
    """Return True if the exception is a Yahoo Finance rate-limit error."""
    if _YFRateLimitError and isinstance(e, _YFRateLimitError):
        return True
    err = str(e).lower()
    return "too many requests" in err or "rate limit" in err or "429" in err


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
    """Retry a function with backoff, waiting longer on rate-limit errors."""
    last_err = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                if _is_yf_rate_limit(e):
                    # Yahoo Finance rate limits need a longer cool-down
                    time.sleep(30 + attempt * 15)  # 30s, 45s
                else:
                    time.sleep(3 + attempt * 5)  # 3s, 8s
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


def get_company_info(ticker: str, retries: int = 3) -> dict:
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
            "target_mean_price": _safe_val(info.get("targetMeanPrice")),
            "target_low_price": _safe_val(info.get("targetLowPrice")),
            "target_high_price": _safe_val(info.get("targetHighPrice")),
            "number_of_analyst_opinions": info.get("numberOfAnalystOpinions"),
            "recommendation_key": info.get("recommendationKey", ""),
        }

    result = _retry(_fetch, retries)
    _cache_set(cache_key, result)
    return result


def get_financials(ticker: str, retries: int = 3) -> dict:
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

    result = _retry(_fetch, retries)
    _cache_set(cache_key, result)
    return result


def get_dividend_history(ticker: str, retries: int = 3) -> list:
    """Fetch dividend history as list of {date, dividend} dicts."""
    cache_key = f"dividends:{ticker}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
        divs = t.dividends
        if divs is None or len(divs) == 0:
            return []
        result = []
        for date, amount in divs.items():
            result.append({
                "date": str(date)[:10],
                "dividend": float(amount),
            })
        return result[-20:]  # last 20 dividends

    result = _retry(_fetch, retries)
    _cache_set(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Normalized financials for fallback merging with screener.in uploads
# ---------------------------------------------------------------------------

# Mapping from yfinance field names → our internal standard field names
# (matching the values in spreadsheet_parser._FIELD_MAP_RAW)
_YF_TO_STANDARD = {
    # Balance Sheet — aggregate totals (the ones user wants filled from YF)
    "CurrentAssets":                         "Current Assets",
    "TotalCurrentAssets":                    "Current Assets",
    "CurrentLiabilities":                    "Current Liabilities",
    "TotalCurrentLiabilities":               "Current Liabilities",
    "NonCurrentAssets":                      "Total Non Current Assets",
    "TotalNonCurrentAssets":                 "Total Non Current Assets",
    "NonCurrentLiabilities":                 "Total Non Current Liabilities",
    "TotalNonCurrentLiabilities":            "Total Non Current Liabilities",
    # Balance Sheet — other fields
    "TotalAssets":                           "Total Assets",
    "CommonStock":                           "Common Stock",
    "RetainedEarnings":                      "Retained Earnings",
    "TotalDebt":                             "Total Debt",
    "LongTermDebt":                          "Total Debt",
    "ShortTermDebt":                         "Short Term Debt",
    "CashAndCashEquivalents":                "Cash And Cash Equivalents",
    "Cash":                                  "Cash And Cash Equivalents",
    "Inventory":                             "Inventory",
    "NetReceivables":                        "Net Receivables",
    "AccountsReceivable":                    "Net Receivables",
    "PropertyPlantAndEquipmentNet":          "Property Plant And Equipment",
    "NetPPE":                                "Property Plant And Equipment",
    "Investments":                           "Investments",
    "OtherAssets":                           "Other Assets",
    "StockholdersEquity":                    "Stockholders Equity",
    "TotalEquityGrossMinorityInterest":      "Stockholders Equity",
    "OtherLiabilities":                      "Other Liabilities",
    # Income Statement
    "TotalRevenue":                          "Total Revenue",
    "NetIncome":                             "Net Income",
    "OperatingIncome":                       "Operating Income",
    "InterestExpense":                       "Interest Expense",
    "GrossProfit":                           "Gross Profit",
    "EBITDA":                                "EBITDA",
    "BasicEPS":                              "Basic EPS",
    "TaxProvision":                          "Tax Provision",
    "PretaxIncome":                          "Pretax Income",
    # Cash Flow
    "OperatingCashFlow":                     "Operating Cash Flow",
    "FreeCashFlow":                          "Free Cash Flow",
    "CapitalExpenditures":                   "Capital Expenditure",
    "InvestingCashFlow":                     "Cash From Investing",
    "FinancingCashFlow":                     "Cash From Financing",
}


def get_financials_normalized(ticker: str, divide_by: float = None, retries: int = 3) -> dict:
    """Fetch financials from Yahoo Finance with normalized field names and year-based periods.

    Returns {stmt_type: {year_str: {standard_field: value}}}
    e.g. {"balance_sheet": {"2024": {"Current Assets": 5123.4, ...}, ...}}

    Args:
        ticker: Yahoo Finance ticker symbol (e.g. "VBL.NS", "AAPL")
        divide_by: if set, divide all numeric values by this factor.
            Use 10_000_000 when merging with screener.in Crore-unit data for Indian stocks.
    """
    cache_key = f"financials_norm:{ticker}:{divide_by}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        raw = get_financials(ticker, retries=retries)
    except Exception:
        return {}

    result = {}
    for stmt_type, stmt_data in raw.items():
        normalized_stmt = {}
        for date_key, period_data in stmt_data.items():
            # "2024-03-31T00:00:00" → "2024"
            year = str(date_key)[:4]
            if year not in normalized_stmt:
                normalized_stmt[year] = {}
            for yf_field, value in period_data.items():
                if value is None:
                    continue
                standard = _YF_TO_STANDARD.get(yf_field)
                if standard is None:
                    continue
                # First occurrence for this (year, standard field) wins
                if standard in normalized_stmt[year]:
                    continue
                if divide_by:
                    try:
                        value = value / divide_by
                    except (TypeError, ZeroDivisionError):
                        continue
                normalized_stmt[year][standard] = value
        result[stmt_type] = normalized_stmt

    _cache_set(cache_key, result)
    return result


_MONTH_ABBR = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


def get_quarterly_financials(ticker: str) -> dict:
    """Fetch quarterly income statement data using yfinance.

    Returns {quarter_label: {field_name: value}} e.g. {"Mar-22": {"Net Income": 254, ...}}.
    """
    cache_key = f"quarterly:{ticker}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
        df = t.quarterly_income_stmt
        if df is None or df.empty:
            return {}
        result = {}
        for col in df.columns:
            if isinstance(col, pd.Timestamp):
                label = f"{_MONTH_ABBR.get(col.month, 'Jan')}-{str(col.year)[2:]}"
            else:
                label = str(col)
            period_data = {}
            for idx in df.index:
                val = _safe_val(df.at[idx, col])
                if val is not None:
                    period_data[str(idx)] = val
            if period_data:
                result[label] = period_data
        return result

    try:
        result = _retry(_fetch)
    except Exception:
        result = {}
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


def get_shareholders(ticker: str, retries: int = 3) -> list:
    """Fetch top 10 institutional shareholders from Yahoo Finance."""
    cache_key = f"shareholders:{ticker}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
        df = t.institutional_holders
        if df is None or df.empty:
            return []
        result = []
        for _, row in df.head(10).iterrows():
            # Column name for % held varies by yfinance version: '% Out', 'pctHeld', 'Pct Held'
            pct = row.get("% Out") if "% Out" in row.index else (
                row.get("pctHeld") if "pctHeld" in row.index else row.get("Pct Held")
            )
            result.append({
                "holder": str(row.get("Holder", "")),
                "shares": _safe_val(row.get("Shares")),
                "pct_out": _safe_val(pct),
                "value": _safe_val(row.get("Value")),
            })
        return result

    try:
        result = _retry(_fetch, retries)
    except Exception:
        result = []
    _cache_set(cache_key, result)
    return result


def get_news(ticker: str, limit: int = 5) -> list:
    """Fetch recent news articles from Yahoo Finance.

    yfinance >= 0.2.54 wraps article fields inside a nested 'content' dict.
    Older versions use flat top-level keys (title, publisher, link, providerPublishTime).
    This function handles both formats.
    """
    cache_key = f"news:{ticker}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        _rate_limit()
        t = yf.Ticker(ticker)
        articles = t.news or []
        result = []
        for article in articles[:limit]:
            # New format (yfinance >= 0.2.54): fields nested under 'content'
            content = article.get("content") or {}

            title = content.get("title") or article.get("title", "")

            publisher_raw = content.get("publisher") or content.get("provider") or article.get("publisher", "")
            if isinstance(publisher_raw, dict):
                publisher = publisher_raw.get("displayName") or publisher_raw.get("name", "")
            else:
                publisher = str(publisher_raw) if publisher_raw else ""

            link = (
                (content.get("canonicalUrl") or {}).get("url")
                or content.get("url")
                or content.get("link")
                or article.get("link", "")
            )

            pub_time = content.get("pubDate") or article.get("providerPublishTime")

            if title:
                result.append({
                    "title": title,
                    "publisher": publisher,
                    "link": link,
                    "published_at": pub_time,
                })
        return result

    try:
        result = _retry(_fetch)
    except Exception:
        result = []
    _cache_set(cache_key, result)
    return result


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
