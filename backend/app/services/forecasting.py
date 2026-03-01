"""3-year financial forecasting engine based on historical trends and user assumptions."""

import numpy as np
from app.config import FORECAST_YEARS
from app.services.financial_analysis import _get, _safe_div, _get_latest_period


def _historical_cagr(values: list[float], years: int = None) -> float:
    """Compute CAGR from a list of values (oldest to newest)."""
    clean = [v for v in values if v is not None and v > 0]
    if len(clean) < 2:
        return 0.05  # default 5% growth
    n = years or (len(clean) - 1)
    if n <= 0:
        return 0.05
    return (clean[-1] / clean[0]) ** (1 / n) - 1


def _historical_average(values: list[float]) -> float:
    clean = [v for v in values if v is not None]
    if not clean:
        return 0.0
    return sum(clean) / len(clean)


def build_forecast(financials: dict, assumptions: dict = None) -> dict:
    """Build a 3-year financial forecast.

    Args:
        financials: dict with income_statement, balance_sheet, cash_flow
        assumptions: optional overrides for growth rates and margins

    Returns:
        dict with projected income statement, balance sheet items, and cash flows
    """
    assumptions = assumptions or {}
    is_data = financials.get("income_statement", {})
    bs_data = financials.get("balance_sheet", {})
    cf_data = financials.get("cash_flow", {})

    # Sort periods chronologically (oldest first)
    is_periods = sorted(is_data.keys())
    bs_periods = sorted(bs_data.keys())
    cf_periods = sorted(cf_data.keys())

    # Extract historical revenue series
    hist_revenue = [_get(is_data[p], "Total Revenue") for p in is_periods]

    # Extract historical margins
    hist_ebitda_margins = []
    hist_net_margins = []
    hist_capex_pcts = []
    hist_da_pcts = []
    hist_nwc_pcts = []

    for i, p in enumerate(is_periods):
        rev = _get(is_data[p], "Total Revenue")
        ebitda = _get(is_data[p], "EBITDA")
        oi = _get(is_data[p], "Operating Income")
        da = _get(is_data[p], "Depreciation And Amortization")
        ni = _get(is_data[p], "Net Income")

        if ebitda is None and oi is not None and da is not None:
            ebitda = oi + abs(da)

        hist_ebitda_margins.append(_safe_div(ebitda, rev))
        hist_net_margins.append(_safe_div(ni, rev))

        # CapEx and D&A from cash flow
        if i < len(cf_periods):
            cf_p = cf_data.get(cf_periods[i], {})
            capex = _get(cf_p, "Capital Expenditure")
            da_cf = _get(cf_p, "Depreciation And Amortization") or (abs(da) if da else None)
            hist_capex_pcts.append(_safe_div(abs(capex) if capex else None, rev))
            hist_da_pcts.append(_safe_div(abs(da_cf) if da_cf else None, rev))

        # NWC from balance sheet
        if i < len(bs_periods):
            bs_p = bs_data.get(bs_periods[i], {})
            ca = _get(bs_p, "Current Assets")
            cl = _get(bs_p, "Current Liabilities")
            cash = _get(bs_p, "Cash And Cash Equivalents", 0)
            nwc = (ca - cash - cl) if ca is not None and cl is not None else None
            hist_nwc_pcts.append(_safe_div(nwc, rev))

    # Determine assumptions (user overrides or historical averages)
    revenue_cagr = _historical_cagr(hist_revenue)
    user_growth = assumptions.get("revenue_growth_rates")
    if user_growth and len(user_growth) >= FORECAST_YEARS:
        growth_rates = user_growth[:FORECAST_YEARS]
    else:
        # Gradually reduce growth toward long-term average
        g = min(revenue_cagr, 0.30)  # cap at 30%
        growth_rates = [g, g * 0.9, g * 0.8]

    ebitda_margin = assumptions.get("ebitda_margin") or _historical_average(
        [m for m in hist_ebitda_margins if m is not None]
    ) or 0.20
    net_margin = assumptions.get("net_margin") or _historical_average(
        [m for m in hist_net_margins if m is not None]
    ) or 0.12
    capex_pct = assumptions.get("capex_pct_revenue") or _historical_average(
        [m for m in hist_capex_pcts if m is not None]
    ) or 0.05
    da_pct = assumptions.get("da_pct_revenue") or _historical_average(
        [m for m in hist_da_pcts if m is not None]
    ) or 0.04
    nwc_pct = assumptions.get("nwc_pct_revenue") or _historical_average(
        [m for m in hist_nwc_pcts if m is not None]
    ) or 0.10

    # Latest actuals
    latest_rev = hist_revenue[-1] if hist_revenue and hist_revenue[-1] else 100_000_000_000
    latest_bs = bs_data.get(bs_periods[-1], {}) if bs_periods else {}
    latest_total_debt = _get(latest_bs, "Total Debt", 0) or 0
    latest_cash = _get(latest_bs, "Cash And Cash Equivalents", 0) or 0
    latest_equity = _get(latest_bs, "Stockholders Equity", 0) or 0

    # Build projections
    projections = []
    prev_revenue = latest_rev
    prev_nwc = nwc_pct * latest_rev

    for yr in range(FORECAST_YEARS):
        g = growth_rates[yr] if yr < len(growth_rates) else growth_rates[-1]
        revenue = prev_revenue * (1 + g)
        ebitda = revenue * ebitda_margin
        da = revenue * da_pct
        ebit = ebitda - da
        tax_rate = assumptions.get("tax_rate", 0.21)
        nopat = ebit * (1 - tax_rate)
        net_inc = revenue * net_margin
        capex = revenue * capex_pct
        nwc = revenue * nwc_pct
        delta_nwc = nwc - prev_nwc
        fcf = nopat + da - capex - delta_nwc

        projections.append({
            "year": yr + 1,
            "revenue": round(revenue, 0),
            "revenue_growth": round(g, 4),
            "ebitda": round(ebitda, 0),
            "ebitda_margin": round(ebitda_margin, 4),
            "depreciation_amortization": round(da, 0),
            "ebit": round(ebit, 0),
            "nopat": round(nopat, 0),
            "net_income": round(net_inc, 0),
            "net_margin": round(net_margin, 4),
            "capex": round(capex, 0),
            "capex_pct_revenue": round(capex_pct, 4),
            "nwc": round(nwc, 0),
            "delta_nwc": round(delta_nwc, 0),
            "fcf": round(fcf, 0),
        })

        prev_revenue = revenue
        prev_nwc = nwc

    return {
        "assumptions": {
            "revenue_growth_rates": [round(g, 4) for g in growth_rates],
            "ebitda_margin": round(ebitda_margin, 4),
            "net_margin": round(net_margin, 4),
            "capex_pct_revenue": round(capex_pct, 4),
            "da_pct_revenue": round(da_pct, 4),
            "nwc_pct_revenue": round(nwc_pct, 4),
            "tax_rate": assumptions.get("tax_rate", 0.21),
        },
        "base_revenue": round(latest_rev, 0),
        "projections": projections,
        "historical_cagr": round(revenue_cagr, 4),
    }
