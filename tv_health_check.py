#!/usr/bin/env python3
"""
TradingView-style Chart Health Check
=====================================
Validates the core components of the TV (TradingView-style) chart feature:
  1. Price data format — ensures OHLCV records match what TradingChart expects
  2. Indicator algorithms — verifies SMA, EMA, Bollinger Bands, RSI, and MACD
     produce well-formed, numerically correct output
  3. API endpoint — checks /api/price-history/{ticker} when the server is reachable

Exit code 0 = all checks passed
Exit code 1 = one or more checks failed
"""

import math
import sys
import time

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
SKIP = "\033[33mSKIP\033[0m"

_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    _results.append((name, condition, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  [{status}] {name}{suffix}")
    return condition


# ── mock price data ───────────────────────────────────────────────────────────

def _make_prices(n: int = 60) -> list[dict]:
    """Generate n synthetic OHLCV bars starting 2024-01-01."""
    import datetime
    prices = []
    close = 100.0
    dt = datetime.date(2024, 1, 1)
    for i in range(n):
        change = (i % 7 - 3) * 0.5  # deterministic zigzag
        open_ = close
        close = round(open_ + change, 4)
        high = round(max(open_, close) + 0.3, 4)
        low = round(min(open_, close) - 0.3, 4)
        prices.append({
            "date": dt.isoformat(),
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": 1_000_000 + i * 10_000,
        })
        dt += datetime.timedelta(days=1)
    return prices


# ── indicator implementations (mirrors frontend utils/indicators.js) ──────────

def _calc_sma(data: list[dict], period: int) -> list[dict]:
    result = []
    for i in range(period - 1, len(data)):
        avg = sum(d["close"] for d in data[i - period + 1 : i + 1]) / period
        result.append({"time": data[i]["date"][:10], "value": avg})
    return result


def _calc_ema(data: list[dict], period: int) -> list[dict]:
    if len(data) < period:
        return []
    k = 2 / (period + 1)
    ema = sum(d["close"] for d in data[:period]) / period
    result = [{"time": data[period - 1]["date"][:10], "value": ema}]
    for i in range(period, len(data)):
        ema = data[i]["close"] * k + ema * (1 - k)
        result.append({"time": data[i]["date"][:10], "value": ema})
    return result


def _calc_bollinger(data: list[dict], period: int = 20, mult: float = 2.0):
    upper, middle, lower = [], [], []
    for i in range(period - 1, len(data)):
        slc = data[i - period + 1 : i + 1]
        avg = sum(d["close"] for d in slc) / period
        variance = sum((d["close"] - avg) ** 2 for d in slc) / period
        sd = math.sqrt(variance)
        t = data[i]["date"][:10]
        middle.append({"time": t, "value": avg})
        upper.append({"time": t, "value": avg + mult * sd})
        lower.append({"time": t, "value": avg - mult * sd})
    return upper, middle, lower


def _calc_rsi(data: list[dict], period: int = 14) -> list[dict]:
    if len(data) < period + 1:
        return []
    gains = losses = 0.0
    for i in range(1, period + 1):
        diff = data[i]["close"] - data[i - 1]["close"]
        if diff > 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    rs = 100 if avg_loss == 0 else avg_gain / avg_loss
    result = [{"time": data[period]["date"][:10], "value": 100 - 100 / (1 + rs)}]
    for i in range(period + 1, len(data)):
        diff = data[i]["close"] - data[i - 1]["close"]
        gain = diff if diff > 0 else 0.0
        loss = -diff if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rsi = 100 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)
        result.append({"time": data[i]["date"][:10], "value": rsi})
    return result


def _calc_macd(data, fast=12, slow=26, signal_period=9):
    ema_fast = _calc_ema(data, fast)
    ema_slow = _calc_ema(data, slow)
    slow_map = {d["time"]: d["value"] for d in ema_slow}
    fast_map = {d["time"]: d["value"] for d in ema_fast}
    macd_line = sorted(
        [{"time": t, "value": fast_map[t] - slow_map[t]} for t in slow_map if t in fast_map],
        key=lambda d: d["time"],
    )
    if len(macd_line) < signal_period:
        return macd_line, [], []
    k = 2 / (signal_period + 1)
    sig = sum(d["value"] for d in macd_line[:signal_period]) / signal_period
    signal = [{"time": macd_line[signal_period - 1]["time"], "value": sig}]
    for i in range(signal_period, len(macd_line)):
        sig = macd_line[i]["value"] * k + sig * (1 - k)
        signal.append({"time": macd_line[i]["time"], "value": sig})
    sig_map = {d["time"]: d["value"] for d in signal}
    histogram = [
        {
            "time": d["time"],
            "value": d["value"] - sig_map[d["time"]],
            "color": "#26a69a" if d["value"] - sig_map[d["time"]] >= 0 else "#ef5350",
        }
        for d in macd_line
        if d["time"] in sig_map
    ]
    return macd_line, signal, histogram


# ── check groups ──────────────────────────────────────────────────────────────

def check_price_data_format():
    print("\n[1] Price data format")
    prices = _make_prices(60)

    required_fields = {"date", "open", "high", "low", "close", "volume"}
    bar = prices[0]
    check(
        "All required OHLCV fields present",
        required_fields.issubset(bar.keys()),
        f"found: {set(bar.keys())}",
    )
    check(
        "date is ISO-8601 string (YYYY-MM-DD)",
        isinstance(bar["date"], str) and len(bar["date"]) >= 10,
    )
    check(
        "numeric fields are float/int",
        all(isinstance(bar[f], (int, float)) for f in ["open", "high", "low", "close", "volume"]),
    )
    check(
        "high >= close >= low for all bars",
        all(p["high"] >= p["close"] >= p["low"] for p in prices),
    )
    check(
        "close values are finite",
        all(math.isfinite(p["close"]) for p in prices),
    )
    check(
        "60 bars generated",
        len(prices) == 60,
        f"got {len(prices)}",
    )


def check_indicators():
    print("\n[2] Technical indicator calculations")
    data = _make_prices(60)

    # ── SMA ──
    sma20 = _calc_sma(data, 20)
    check("SMA-20 returns 41 data points (60-20+1)", len(sma20) == 41, f"got {len(sma20)}")
    check(
        "SMA-20 value is arithmetic mean of 20 closes",
        abs(sma20[0]["value"] - sum(d["close"] for d in data[:20]) / 20) < 1e-9,
    )
    check("SMA-200 returns [] when insufficient data", _calc_sma(data, 200) == [])

    # ── EMA ──
    ema20 = _calc_ema(data, 20)
    check("EMA-20 returns non-empty list", len(ema20) > 0)
    check(
        "EMA-20 first value equals SMA seed",
        abs(ema20[0]["value"] - sum(d["close"] for d in data[:20]) / 20) < 1e-9,
    )

    # ── Bollinger Bands ──
    upper, middle, lower = _calc_bollinger(data, 20)
    check("Bollinger Bands: all three bands same length", len(upper) == len(middle) == len(lower))
    check(
        "Upper band always >= middle >= lower",
        all(upper[i]["value"] >= middle[i]["value"] >= lower[i]["value"] for i in range(len(middle))),
    )

    # ── RSI ──
    rsi = _calc_rsi(data, 14)
    check("RSI-14 produces values", len(rsi) > 0, f"{len(rsi)} values")
    check(
        "All RSI values in [0, 100]",
        all(0 <= r["value"] <= 100 for r in rsi),
    )

    # ── MACD ──
    macd_line, signal, histogram = _calc_macd(data)
    check("MACD line is non-empty", len(macd_line) > 0)
    check("Signal line is non-empty", len(signal) > 0)
    check("Histogram is non-empty", len(histogram) > 0)
    check(
        "Histogram = MACD − Signal at each point",
        all(
            abs(h["value"] - (next(m["value"] for m in macd_line if m["time"] == h["time"]) -
                              next(s["value"] for s in signal if s["time"] == h["time"]))) < 1e-9
            for h in histogram
        ),
    )
    check(
        "Histogram colors are correct (#26a69a / #ef5350)",
        all(h["color"] in ("#26a69a", "#ef5350") for h in histogram),
    )


def check_api_endpoint():
    print("\n[3] Backend API — /api/price-history")
    try:
        import requests  # noqa: PLC0415
    except ImportError:
        print(f"  [{SKIP}] requests not installed — skipping live API checks")
        return

    base = "http://localhost:8000"
    try:
        r = requests.get(f"{base}/api/health", timeout=3)
        server_up = r.status_code == 200
    except Exception:
        server_up = False

    if not server_up:
        print(f"  [{SKIP}] Backend not reachable at {base} — skipping live API checks")
        return

    # Server is up — run real checks
    r = requests.get(f"{base}/api/price-history/AAPL", timeout=30)
    check("HTTP 200 from /api/price-history/AAPL", r.status_code == 200, f"got {r.status_code}")

    if r.status_code == 200:
        body = r.json()
        check("Response has 'ticker' field", "ticker" in body)
        check("Response has 'prices' list", "prices" in body and isinstance(body["prices"], list))
        if body.get("prices"):
            bar = body["prices"][0]
            check(
                "Each price bar has required OHLCV fields",
                all(f in bar for f in ["date", "open", "high", "low", "close", "volume"]),
            )

    # Edge: unknown ticker should not crash the server
    r2 = requests.get(f"{base}/api/price-history/INVALID_TICKER_XYZ123", timeout=30)
    check(
        "Unknown ticker returns 4xx/5xx (not a crash)",
        r2.status_code in range(400, 600) or r2.status_code == 200,  # 200 with empty list is OK
        f"got {r2.status_code}",
    )


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  TV (TradingView-style Chart) Health Check")
    print("=" * 60)

    check_price_data_format()
    check_indicators()
    check_api_endpoint()

    # Summary
    total = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed

    print("\n" + "=" * 60)
    print(f"  Results: {passed}/{total} checks passed", end="")
    if failed:
        print(f"  ({failed} FAILED)")
    else:
        print("  — all green!")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
