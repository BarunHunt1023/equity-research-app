"""Build screener.in-style financial tables with derived metrics and CAGR trends."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_div(a, b):
    """Return a/b or None if b is zero/None."""
    if a is None or b is None or b == 0:
        return None
    return a / b


def _pct(a, b):
    """Return a/b * 100 as a percentage float, or None."""
    v = _safe_div(a, b)
    return round(v * 100, 2) if v is not None else None


def _yoy(curr, prev):
    """Year-over-year growth as a percentage float (e.g. 25.5 means 25.5%)."""
    if curr is None or prev is None or prev == 0:
        return None
    return round((curr - prev) / abs(prev) * 100, 1)


def _compute_cagr(start_val, end_val, n_years):
    """CAGR as a percentage float, e.g. 15.2 means 15.2%."""
    if start_val is None or end_val is None or n_years == 0:
        return None
    if start_val <= 0 or end_val <= 0:
        return None
    try:
        return round(((end_val / start_val) ** (1.0 / n_years) - 1) * 100, 1)
    except (ZeroDivisionError, ValueError):
        return None


def _get(period_data: dict, *keys) -> Any:
    """Retrieve a value from period_data using multiple fallback key names."""
    for k in keys:
        v = period_data.get(k)
        if v is not None:
            return v
        # case-insensitive fallback
        kl = k.lower()
        for dk, dv in period_data.items():
            if dk.lower() == kl and dv is not None:
                return dv
    return None


def _round_val(v):
    """Round to integer for display (values in Cr are whole numbers)."""
    if v is None:
        return None
    return round(v)


# ---------------------------------------------------------------------------
# Column ordering helpers
# ---------------------------------------------------------------------------

_MONTH_ORDER = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _sort_key_quarterly(period_str: str):
    """Sort key for quarterly period labels like 'Mar-22', 'Jun-22'."""
    parts = period_str.split("-")
    if len(parts) == 2:
        month = parts[0].lower()[:3]
        year_s = parts[1]
        year = int(year_s) + (2000 if len(year_s) == 2 and int(year_s) < 50 else
                              (1900 if len(year_s) == 2 else 0))
        return (year, _MONTH_ORDER.get(month, 0))
    return (9999, 0)


def _sort_key_annual(period_str: str):
    """Sort key for annual period labels like '2014', 'Dec-14', 'Dec-23'."""
    # Handle "Dec-14" style
    parts = period_str.split("-")
    if len(parts) == 2:
        month = parts[0].lower()[:3]
        year_s = parts[1]
        year = int(year_s) + (2000 if len(year_s) == 2 and int(year_s) < 50 else
                              (1900 if len(year_s) == 2 else 0))
        return (year, _MONTH_ORDER.get(month, 0))
    # Handle "2014" style
    try:
        return (int(period_str), 0)
    except ValueError:
        return (9999, 0)


# ---------------------------------------------------------------------------
# CAGR trend builder
# ---------------------------------------------------------------------------

def _build_trend_values(series: list, sorted_periods: list, year_windows=(9, 7, 5, 3)):
    """
    Given a list of values aligned with sorted_periods, compute CAGR for each
    window (9, 7, 5, 3 years) going backwards from the last period.

    Returns a list of 4 values (one per window), each a percentage float or None.
    """
    n = len(sorted_periods)
    if n < 2:
        return [None, None, None, None]

    # Latest value (last period) — if None, no CAGR can be computed
    end_val = series[-1]
    if end_val is None:
        return [None, None, None, None]

    results = []
    for years in year_windows:
        start_idx = n - 1 - years
        if start_idx < 0:
            start_idx = 0
        actual_years = (n - 1) - start_idx
        if actual_years == 0:
            results.append(None)
            continue
        start_val = series[start_idx]
        results.append(_compute_cagr(start_val, end_val, actual_years))

    return results


def _build_trend_rows(rows_data: list, sorted_periods: list):
    """
    Given rows_data (list of {label, type, values}) for annual periods,
    return trend rows: same label/type but values are [9Y CAGR, 7Y CAGR, 5Y CAGR, 3Y CAGR].
    Only compute trends for non-italic rows (absolute value rows), not percentage rows.
    """
    trend_rows = []
    for row in rows_data:
        if row["type"] == "section":
            trend_rows.append({
                "label": row["label"],
                "type": "section",
                "values": [None, None, None, None],
            })
            continue
        if row["type"] == "italic":
            # For italic rows (percentages/ratios), show blank trend
            trend_rows.append({
                "label": row["label"],
                "type": "italic",
                "values": [None, None, None, None],
            })
            continue
        # For bold/normal rows: compute CAGR (skip the LTM column = last value)
        values = row["values"][:-1] if row.get("has_ltm") else row["values"]
        cagr_values = _build_trend_values(values, sorted_periods)
        trend_rows.append({
            "label": row["label"],
            "type": row["type"],
            "values": cagr_values,
        })
    return trend_rows


# ---------------------------------------------------------------------------
# 1. Quarterly Results table
# ---------------------------------------------------------------------------

def build_quarterly_results(quarterly_data: dict, annual_income: dict, company_name: str) -> dict:
    """
    Build the Quarterly Results table.

    quarterly_data: {quarter_label: {field: value}}  e.g. {"Mar-22": {"Net Income": 254, ...}}
    annual_income:  {year: {field: value}}  used as fallback if no quarterly data
    """
    if not quarterly_data:
        return {"company_name": company_name, "columns": [], "rows": []}

    # Sort quarters chronologically
    sorted_q = sorted(quarterly_data.keys(), key=_sort_key_quarterly)

    # For each quarter, extract Revenue (used for ratio computation but not displayed)
    def qval(q, *keys):
        return _get(quarterly_data.get(q, {}), *keys)

    # Build absolute value series
    def series(q_list, *keys):
        return [_round_val(qval(q, *keys)) for q in q_list]

    op_vals = series(sorted_q, "EBITDA", "Operating Income")
    oi_vals = series(sorted_q, "Other Income")
    dep_vals = series(sorted_q, "Depreciation And Amortization")
    int_vals = series(sorted_q, "Interest Expense")
    pbt_vals = series(sorted_q, "Pretax Income")
    tax_vals = series(sorted_q, "Tax Provision")
    np_vals  = series(sorted_q, "Net Income")
    rev_vals = [qval(q, "Total Revenue") for q in sorted_q]

    # Compute TTM (sum of last 4 quarters)
    def ttm(vals):
        last4 = vals[-4:] if len(vals) >= 4 else vals
        valid = [v for v in last4 if v is not None]
        return round(sum(valid)) if valid else None

    ttm_op  = ttm(op_vals)
    ttm_oi  = ttm(oi_vals)
    ttm_dep = ttm(dep_vals)
    ttm_int = ttm(int_vals)
    ttm_pbt = ttm(pbt_vals)
    ttm_tax = ttm(tax_vals)
    ttm_np  = ttm(np_vals)
    ttm_rev = ttm(rev_vals)

    # PBT Margin (%) per quarter
    pbt_margin_vals = [_pct(pbt_vals[i], rev_vals[i]) for i in range(len(sorted_q))]
    pbt_margin_ttm  = _pct(ttm_pbt, ttm_rev)

    # OPM (%) per quarter
    opm_vals = [_pct(op_vals[i], rev_vals[i]) for i in range(len(sorted_q))]
    opm_ttm  = _pct(ttm_op, ttm_rev)

    # % Growth YOY for PBT (quarterly YOY)
    pbt_yoy = [None] * len(sorted_q)
    for i in range(len(sorted_q)):
        if i >= 4:
            pbt_yoy[i] = _yoy(pbt_vals[i], pbt_vals[i - 4])

    # % Growth YOY for Net Profit (quarterly YOY)
    np_yoy = [None] * len(sorted_q)
    for i in range(len(sorted_q)):
        if i >= 4:
            np_yoy[i] = _yoy(np_vals[i], np_vals[i - 4])

    columns = sorted_q + ["TTM"]

    def with_ttm(vals, ttm_val):
        return vals + [ttm_val]

    rows = [
        {"label": "Operating Profit", "type": "bold",   "values": with_ttm(op_vals,  ttm_op)},
        {"label": "Other Income",      "type": "normal", "values": with_ttm(oi_vals,  ttm_oi)},
        {"label": "Depreciation",      "type": "normal", "values": with_ttm(dep_vals, ttm_dep)},
        {"label": "Interest",          "type": "normal", "values": with_ttm(int_vals, ttm_int)},
        {"label": "Profit before tax", "type": "normal", "values": with_ttm(pbt_vals, ttm_pbt)},
        {"label": "PBT Margin",        "type": "italic", "values": with_ttm(pbt_margin_vals, pbt_margin_ttm)},
        {"label": "% Growth YOY",      "type": "italic", "values": with_ttm(pbt_yoy,  None)},
        {"label": "Tax",               "type": "normal", "values": with_ttm(tax_vals, ttm_tax)},
        {"label": "Net profit",        "type": "bold",   "values": with_ttm(np_vals,  ttm_np)},
        {"label": "% Growth YOY",      "type": "italic", "values": with_ttm(np_yoy,   None)},
        {"label": "OPM",               "type": "italic", "values": with_ttm(opm_vals, opm_ttm)},
    ]

    return {
        "company_name": company_name,
        "columns": columns,
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# 2. Profit & Loss table
# ---------------------------------------------------------------------------

def build_profit_loss(annual_income: dict, company_info: dict, shares_outstanding: float) -> dict:
    """Build the annual P&L table with LTM column and TREND OVER YEARS panel."""
    if not annual_income:
        return {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    company_name = company_info.get("name", "") if company_info else ""
    sorted_y = sorted(annual_income.keys(), key=_sort_key_annual)

    def yval(y, *keys):
        return _get(annual_income.get(y, {}), *keys)

    def yseries(*keys):
        return [yval(y, *keys) for y in sorted_y]

    rev_vals  = yseries("Total Revenue")
    gp_vals   = yseries("Gross Profit")
    ebitda_vals = yseries("EBITDA")
    oi_vals   = yseries("Other Income")
    dep_vals  = yseries("Depreciation And Amortization")
    ebit_vals = yseries("Operating Income")
    int_vals  = yseries("Interest Expense")
    pbt_vals  = yseries("Pretax Income")
    tax_vals  = yseries("Tax Provision")
    np_vals   = yseries("Net Income")
    eps_vals  = yseries("Basic EPS", "EPS", "EPS in Rs", "Diluted EPS", "Earnings Per Share")
    div_vals  = yseries("Dividend Payout")

    # Expense breakdown fields
    total_exp_vals  = yseries("Total Expenses")
    material_vals   = yseries("Cost Of Revenue")
    power_fuel_vals = yseries("Power and Fuel Cost")
    mfr_exp_vals    = yseries("Manufacturing Expenses")
    employee_vals   = yseries("Employee Cost")
    selling_vals    = yseries("Other Expenses")

    n = len(sorted_y)

    # Compute derived series
    rev_yoy          = [None] + [_yoy(rev_vals[i], rev_vals[i-1]) for i in range(1, n)]
    # Total expenses fallback: Revenue - Gross Profit
    total_exp_vals   = [
        total_exp_vals[i] if total_exp_vals[i] is not None
        else (_round_val(rev_vals[i] - gp_vals[i]) if rev_vals[i] is not None and gp_vals[i] is not None else None)
        for i in range(n)
    ]
    material_pct     = [_pct(material_vals[i], rev_vals[i]) for i in range(n)]
    power_fuel_pct   = [_pct(power_fuel_vals[i], rev_vals[i]) for i in range(n)]
    mfr_exp_pct      = [_pct(mfr_exp_vals[i], rev_vals[i]) for i in range(n)]
    employee_pct     = [_pct(employee_vals[i], rev_vals[i]) for i in range(n)]
    selling_pct      = [_pct(selling_vals[i], rev_vals[i]) for i in range(n)]
    gp_margin_vals   = [_pct(gp_vals[i], rev_vals[i]) for i in range(n)]
    ebitda_margin_vals = [_pct(ebitda_vals[i], rev_vals[i]) for i in range(n)]
    oi_pct_vals      = [_pct(oi_vals[i], rev_vals[i]) for i in range(n)]
    int_cov_vals     = [_safe_div(ebit_vals[i], int_vals[i]) for i in range(n)]
    pbt_yoy          = [None] + [_yoy(pbt_vals[i], pbt_vals[i-1]) for i in range(1, n)]
    pbt_margin_vals  = [_pct(pbt_vals[i], rev_vals[i]) for i in range(n)]
    tax_rate_vals    = [_pct(tax_vals[i], pbt_vals[i]) for i in range(n)]
    np_yoy           = [None] + [_yoy(np_vals[i], np_vals[i-1]) for i in range(1, n)]
    np_margin_vals   = [_pct(np_vals[i], rev_vals[i]) for i in range(n)]

    # EPS computed if not in data
    # shares_outstanding is stored in absolute count; np_vals is in Crores
    # EPS (Rs/share) = PAT (Crores) / shares (Crores)
    for i in range(n):
        if eps_vals[i] is None and np_vals[i] is not None and shares_outstanding:
            shares_in_cr = shares_outstanding / 1e7
            eps_vals[i] = round(np_vals[i] / shares_in_cr, 1)

    eps_yoy = [None] + [_yoy(eps_vals[i], eps_vals[i-1]) for i in range(1, n)]

    # Price and P/E — use current_price only for latest period
    current_price = company_info.get("current_price") if company_info else None
    price_vals = [None] * n
    pe_vals = [None] * n
    if current_price is not None:
        price_vals[-1] = current_price
        if eps_vals[-1] and eps_vals[-1] != 0:
            pe_vals[-1] = round(current_price / eps_vals[-1], 1)

    # Market cap per period
    market_cap = company_info.get("market_cap") if company_info else None
    mktcap_vals = [None] * n
    if market_cap is not None:
        mktcap_vals[-1] = _round_val(market_cap)

    def with_ltm(vals):
        return list(vals)  # LTM column removed — no duplicate last-period column

    def round_series(vals):
        return [_round_val(v) for v in vals]

    def pct_series(vals):
        return [round(v, 1) if v is not None else None for v in vals]

    def ratio_series(vals):
        return [round(v, 1) if v is not None else None for v in vals]

    columns = sorted_y
    has_ltm = False

    # Helper: only include a row if it has at least one non-None value
    def has_data(vals):
        return any(v is not None for v in vals)

    rows = [
        {"label": "Sales",                   "type": "bold",   "values": with_ltm(round_series(rev_vals)), "has_ltm": has_ltm},
        {"label": "% Growth YOY",            "type": "italic", "values": with_ltm(pct_series(rev_yoy))},
        {"label": "Expenses",                "type": "normal", "values": with_ltm(round_series(total_exp_vals)), "has_ltm": has_ltm},
        *([{"label": "Material Cost (% of Sales)", "type": "italic", "values": with_ltm(pct_series(material_pct))}] if has_data(material_pct) else []),
        *([{"label": "Power and Fuel",        "type": "italic", "values": with_ltm(pct_series(power_fuel_pct))}] if has_data(power_fuel_pct) else []),
        *([{"label": "Other Mfr. Exp",        "type": "italic", "values": with_ltm(pct_series(mfr_exp_pct))}] if has_data(mfr_exp_pct) else []),
        *([{"label": "Employee Cost",         "type": "italic", "values": with_ltm(pct_series(employee_pct))}] if has_data(employee_pct) else []),
        *([{"label": "Selling and Admin Cost","type": "italic", "values": with_ltm(pct_series(selling_pct))}] if has_data(selling_pct) else []),
        {"label": "Gross Profit",            "type": "bold",   "values": with_ltm(round_series(gp_vals)), "has_ltm": has_ltm},
        {"label": "Gross Profit Margin",     "type": "italic", "values": with_ltm(pct_series(gp_margin_vals))},
        {"label": "EBITDA",                  "type": "bold",   "values": with_ltm(round_series(ebitda_vals)), "has_ltm": has_ltm},
        {"label": "EBITDA Margins",          "type": "italic", "values": with_ltm(pct_series(ebitda_margin_vals))},
        {"label": "Other Income",            "type": "normal", "values": with_ltm(round_series(oi_vals)), "has_ltm": has_ltm},
        {"label": "Other Income as % of Sales", "type": "italic", "values": with_ltm(pct_series(oi_pct_vals))},
        {"label": "Depreciation",            "type": "normal", "values": with_ltm(round_series(dep_vals)), "has_ltm": has_ltm},
        {"label": "EBIT",                    "type": "bold",   "values": with_ltm(round_series(ebit_vals)), "has_ltm": has_ltm},
        {"label": "Interest",                "type": "normal", "values": with_ltm(round_series(int_vals)), "has_ltm": has_ltm},
        {"label": "Interest Coverage (Times)","type": "italic", "values": with_ltm(ratio_series(int_cov_vals))},
        {"label": "Profit before tax (PBT)", "type": "bold",   "values": with_ltm(round_series(pbt_vals)), "has_ltm": has_ltm},
        {"label": "% Growth YOY",            "type": "italic", "values": with_ltm(pct_series(pbt_yoy))},
        {"label": "PBT Margin",              "type": "italic", "values": with_ltm(pct_series(pbt_margin_vals))},
        {"label": "Tax",                     "type": "normal", "values": with_ltm(round_series(tax_vals)), "has_ltm": has_ltm},
        {"label": "Actual Tax Rate",         "type": "italic", "values": with_ltm(pct_series(tax_rate_vals))},
        {"label": "Net profit",              "type": "bold",   "values": with_ltm(round_series(np_vals)), "has_ltm": has_ltm},
        {"label": "% Growth YOY",            "type": "italic", "values": with_ltm(pct_series(np_yoy))},
        {"label": "Net Profit Margin",       "type": "italic", "values": with_ltm(pct_series(np_margin_vals))},
        {"label": "EPS",                     "type": "normal", "values": with_ltm(ratio_series(eps_vals)), "has_ltm": has_ltm},
        {"label": "% Growth YOY",            "type": "italic", "values": with_ltm(pct_series(eps_yoy))},
        {"label": "Price to earning",        "type": "italic", "values": with_ltm(ratio_series(pe_vals))},
        {"label": "Price",                   "type": "normal", "values": with_ltm(ratio_series(price_vals)), "has_ltm": has_ltm},
        {"label": "Dividend Payout",         "type": "normal", "values": with_ltm(pct_series([_pct(div_vals[i], np_vals[i]) for i in range(n)])), "has_ltm": has_ltm},
        {"label": "Market Cap",              "type": "normal", "values": with_ltm(mktcap_vals), "has_ltm": has_ltm},
    ]

    trend_rows = _build_trend_rows(rows, sorted_y)

    return {
        "company_name": company_name,
        "columns": columns,
        "trend_columns": ["9 YEARS", "7 YEARS", "5 YEARS", "3 YEARS"],
        "rows": rows,
        "trend_rows": trend_rows,
    }


# ---------------------------------------------------------------------------
# 3. Balance Sheet table
# ---------------------------------------------------------------------------

def build_balance_sheet(annual_bs: dict, annual_income: dict, company_info: dict) -> dict:
    """Build the annual Balance Sheet table with Key Ratios section and CAGR trends."""
    if not annual_bs:
        return {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    company_name = company_info.get("name", "") if company_info else ""
    # Use sorted union of BS periods
    sorted_y = sorted(annual_bs.keys(), key=_sort_key_annual)

    def bval(y, *keys):
        return _get(annual_bs.get(y, {}), *keys)

    def ival(y, *keys):
        return _get(annual_income.get(y, {}), *keys) if annual_income else None

    def bseries(*keys):
        return [bval(y, *keys) for y in sorted_y]

    def iseries(*keys):
        return [ival(y, *keys) for y in sorted_y]

    n = len(sorted_y)

    # Liabilities
    eq_cap = bseries("Common Stock")
    reserves = bseries("Retained Earnings")
    borrowings = bseries("Total Debt")
    short_term_debt = bseries("Short Term Debt")
    other_liab = bseries("Other Liabilities")

    # Assets
    net_block = bseries("Property Plant And Equipment")
    cwip = bseries("Capital Work In Progress")
    investments = bseries("Investments")
    other_assets = bseries("Other Assets")
    total_assets_raw = bseries("Total Assets")

    # Current / Non-Current splits
    curr_assets = bseries("Current Assets")
    curr_liab = bseries("Current Liabilities")
    nc_assets_raw = bseries("Total Non Current Assets")
    nc_liab_raw = bseries("Total Non Current Liabilities")

    debtors = bseries("Net Receivables")
    inventory = bseries("Inventory")
    cash = bseries("Cash And Cash Equivalents")

    # ---- Component-based fallbacks for aggregate rows missing in screener.in exports ----

    # Total Current Assets: use aggregate from data, else sum Cash + Debtors + Inventory
    curr_assets = [
        curr_assets[i] if curr_assets[i] is not None
        else (
            _round_val((cash[i] or 0) + (debtors[i] or 0) + (inventory[i] or 0))
            if any(v is not None for v in [cash[i], debtors[i], inventory[i]])
            else None
        )
        for i in range(n)
    ]

    # Total Non-Current Assets: use aggregate from data,
    # else sum Net Block + CWIP + Investments + Other Assets
    nc_assets_raw = [
        nc_assets_raw[i] if nc_assets_raw[i] is not None
        else (
            _round_val((net_block[i] or 0) + (cwip[i] or 0) + (investments[i] or 0) + (other_assets[i] or 0))
            if any(v is not None for v in [net_block[i], cwip[i], investments[i], other_assets[i]])
            else None
        )
        for i in range(n)
    ]

    # ---- Derived totals ----

    # Total Equity = Equity Share Capital + Reserves
    total_equity_vals = [
        _round_val((eq_cap[i] or 0) + (reserves[i] or 0))
        if eq_cap[i] is not None or reserves[i] is not None else None
        for i in range(n)
    ]

    # Total Non-Current Assets: from YF merge OR component sum (Net Block + CWIP + Inv + Other)
    nc_assets_vals = [nc_assets_raw[i] for i in range(n)]  # already computed via fallback above

    # Total Non-Current Liabilities: from YF merge OR Borrowings + Short-Term Debt + Other Liab
    # Note: screener "Borrowings" may include current portion; the residual curr_liab_final below
    # captures the remaining trade payables / provisions not visible in screener.in condensed BS.
    nc_liab_vals = [
        nc_liab_raw[i] if nc_liab_raw[i] is not None
        else (
            _round_val((borrowings[i] or 0) + (short_term_debt[i] or 0) + (other_liab[i] or 0))
            if any(v is not None for v in [borrowings[i], other_liab[i]])
            else None
        )
        for i in range(n)
    ]

    # Total Assets = NC Assets + Current Assets  (identity-safe; both sides always visible)
    total_assets = [
        _round_val((nc_assets_vals[i] or 0) + (curr_assets[i] or 0))
        if nc_assets_vals[i] is not None or curr_assets[i] is not None else None
        for i in range(n)
    ]

    # Total Liabilities = Total Assets − Total Equity  ← ACCOUNTING IDENTITY (equity excluded)
    total_liab = [
        _round_val(total_assets[i] - total_equity_vals[i])
        if total_assets[i] is not None and total_equity_vals[i] is not None else None
        for i in range(n)
    ]

    # Total Current Liabilities: prefer YF merge value; else residual = Total Liab − NCL
    curr_liab_final = [
        curr_liab[i] if curr_liab[i] is not None
        else (
            _round_val(total_liab[i] - nc_liab_vals[i])
            if total_liab[i] is not None and nc_liab_vals[i] is not None else None
        )
        for i in range(n)
    ]

    # Working Capital = Current Assets − Current Liabilities
    wc_vals = [
        _round_val((ca or 0) - (cl or 0))
        if ca is not None or cl is not None else None
        for ca, cl in zip(curr_assets, curr_liab_final)
    ]

    def has_data(vals):
        return any(v is not None for v in vals)

    # Key Ratios (using income data)
    rev_vals = iseries("Total Revenue")
    np_vals = iseries("Net Income")
    ebit_vals = iseries("Operating Income")
    int_vals = iseries("Interest Expense")
    equity_vals = bseries("Stockholders Equity")

    debtor_days = [
        round(_safe_div((debtors[i] or 0) * 365, rev_vals[i]) or 0, 1) if debtors[i] is not None and rev_vals[i] else None
        for i in range(n)
    ]
    inv_turnover = [
        round(_safe_div(rev_vals[i], inventory[i]), 1) if rev_vals[i] and inventory[i] else None
        for i in range(n)
    ]
    fa_turnover = [
        round(_safe_div(rev_vals[i], net_block[i]), 1) if rev_vals[i] and net_block[i] else None
        for i in range(n)
    ]
    de_ratio = [
        _pct(borrowings[i], equity_vals[i]) if borrowings[i] is not None and equity_vals[i] else None
        for i in range(n)
    ]
    roe = [
        _pct(np_vals[i], equity_vals[i]) if np_vals[i] is not None and equity_vals[i] else None
        for i in range(n)
    ]
    # ROCE = EBIT / Capital Employed (Total Assets - Current Liabilities)
    roce = []
    for i in range(n):
        if ebit_vals[i] is not None and total_assets[i] and curr_liab_final[i] is not None:
            cap_emp = total_assets[i] - curr_liab_final[i]
            roce.append(_pct(ebit_vals[i], cap_emp) if cap_emp else None)
        else:
            roce.append(None)
    # ROIC = NOPAT / Invested Capital  (NOPAT = EBIT * (1 - tax_rate), IC = Equity + Debt)
    roic = []
    for i in range(n):
        ebit = ebit_vals[i]
        eq = equity_vals[i]
        bor = borrowings[i]
        if ebit is not None and eq is not None and bor is not None:
            nopat = ebit * 0.79  # approx 21% tax
            ic = eq + bor
            roic.append(_pct(nopat, ic) if ic else None)
        else:
            roic.append(None)

    # Market cap
    market_cap = company_info.get("market_cap") if company_info else None
    mktcap_vals = [None] * n
    if market_cap is not None:
        mktcap_vals[-1] = _round_val(market_cap)

    def r(vals):
        return [_round_val(v) for v in vals]

    def p(vals):
        return [round(v, 1) if v is not None else None for v in vals]

    rows = [
        # ════════════════════════════════════════
        # ASSETS  (Yahoo Finance layout: assets first)
        # ════════════════════════════════════════
        # Current Assets
        {"label": "Cash & Bank",                   "type": "normal",  "values": r(cash),             "has_ltm": False},
        {"label": "Debtors",                        "type": "normal",  "values": r(debtors),          "has_ltm": False},
        {"label": "Inventory",                      "type": "normal",  "values": r(inventory),        "has_ltm": False},
        {"label": "Total Current Assets",           "type": "bold",    "values": r(curr_assets),      "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # Non-Current Assets
        {"label": "Net Block",                      "type": "normal",  "values": r(net_block),        "has_ltm": False},
        {"label": "Capital Work in Progress",       "type": "normal",  "values": r(cwip),             "has_ltm": False},
        {"label": "Investments",                    "type": "normal",  "values": r(investments),      "has_ltm": False},
        {"label": "Other Assets",                   "type": "normal",  "values": r(other_assets),     "has_ltm": False},
        {"label": "Total Non-Current Assets",       "type": "bold",    "values": r(nc_assets_vals),   "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        {"label": "Total Assets",                   "type": "bold",    "values": r(total_assets),     "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # ════════════════════════════════════════
        # LIABILITIES
        # ════════════════════════════════════════
        # Current Liabilities (residual or from Yahoo Finance; no line-item detail from screener)
        {"label": "Total Current Liabilities",      "type": "bold",    "values": r(curr_liab_final),  "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # Non-Current Liabilities
        {"label": "Borrowings",                     "type": "normal",  "values": r(borrowings),       "has_ltm": False},
        *([{"label": "Short-Term Borrowings",       "type": "normal",  "values": r(short_term_debt),  "has_ltm": False}] if has_data(short_term_debt) else []),
        {"label": "Other Liabilities",              "type": "normal",  "values": r(other_liab),       "has_ltm": False},
        {"label": "Total Non-Current Liabilities",  "type": "bold",    "values": r(nc_liab_vals),     "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # Equity (sources of funds — shown below NCL, before the grand total)
        {"label": "Equity Share Capital",           "type": "normal",  "values": r(eq_cap),           "has_ltm": False},
        {"label": "Reserves",                       "type": "normal",  "values": r(reserves),         "has_ltm": False},
        {"label": "Total Equity",                   "type": "bold",    "values": r(total_equity_vals), "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # Grand total: CL + NCL + Equity = Total Assets (identity always holds)
        {"label": "Total Liabilities",              "type": "bold",    "values": r(total_assets),     "has_ltm": False},
        {"label": "",                               "type": "section", "values": [None]*n},
        # ════════════════════════════════════════
        # ════════════════════════════════════════
        # KEY RATIOS
        # ════════════════════════════════════════
        {"label": "Debtor Days",                    "type": "italic",  "values": p(debtor_days)},
        {"label": "Inventory Turnover",             "type": "italic",  "values": p(inv_turnover)},
        {"label": "Net Fixed Asset Turnover",       "type": "italic",  "values": p(fa_turnover)},
        {"label": "Debt/Equity",                    "type": "italic",  "values": p(de_ratio)},
        {"label": "Return on Equity",               "type": "italic",  "values": p(roe)},
        {"label": "Return on Capital Employed",     "type": "italic",  "values": p(roce)},
        {"label": "Return on Invested Capital",     "type": "italic",  "values": p(roic)},
        {"label": "Market Cap",                     "type": "normal",  "values": mktcap_vals,         "has_ltm": False},
    ]

    trend_rows = _build_trend_rows(rows, sorted_y)

    return {
        "company_name": company_name,
        "columns": sorted_y,
        "trend_columns": ["9 YEARS", "7 YEARS", "5 YEARS", "3 YEARS"],
        "rows": rows,
        "trend_rows": trend_rows,
    }


# ---------------------------------------------------------------------------
# 4. Cash Flow table
# ---------------------------------------------------------------------------

def build_cash_flow(annual_cf: dict, annual_income: dict, company_info: dict) -> dict:
    """Build the annual Cash Flow table with derived ratios and CAGR trends."""
    if not annual_cf:
        return {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    company_name = company_info.get("name", "") if company_info else ""
    sorted_y = sorted(annual_cf.keys(), key=_sort_key_annual)

    def cfval(y, *keys):
        return _get(annual_cf.get(y, {}), *keys)

    def ival(y, *keys):
        return _get(annual_income.get(y, {}), *keys) if annual_income else None

    n = len(sorted_y)

    cfo = [cfval(y, "Operating Cash Flow") for y in sorted_y]
    cfi = [cfval(y, "Cash From Investing") for y in sorted_y]
    cff = [cfval(y, "Cash From Financing") for y in sorted_y]
    capex = [cfval(y, "Capital Expenditure") for y in sorted_y]
    rev = [ival(y, "Total Revenue") for y in sorted_y]
    np  = [ival(y, "Net Income") for y in sorted_y]
    ebitda = [ival(y, "EBITDA") for y in sorted_y]

    # Net Cash Flow
    ncf = [
        _round_val((cfo[i] or 0) + (cfi[i] or 0) + (cff[i] or 0))
        if (cfo[i] is not None or cfi[i] is not None or cff[i] is not None) else None
        for i in range(n)
    ]

    # FCFF = CFO + Capex (capex is typically negative)
    fcff = [
        _round_val((cfo[i] or 0) + (capex[i] or 0))
        if cfo[i] is not None else None
        for i in range(n)
    ]

    # Average FCF (3 years rolling)
    avg_fcf = [None] * n
    for i in range(2, n):
        vals = [fcff[j] for j in range(i-2, i+1) if fcff[j] is not None]
        if vals:
            avg_fcf[i] = _round_val(sum(vals) / len(vals))

    # YoY growth
    cfo_yoy  = [None] + [_yoy(cfo[i], cfo[i-1]) for i in range(1, n)]
    fcf_yoy  = [None] + [_yoy(fcff[i], fcff[i-1]) for i in range(1, n)]

    # Ratios
    cfo_sales  = [_pct(cfo[i], rev[i]) for i in range(n)]
    cfo_np     = [_pct(cfo[i], np[i])  for i in range(n)]
    cfo_ebitda = [_pct(cfo[i], ebitda[i]) for i in range(n)]
    fcf_sales  = [_pct(fcff[i], rev[i])   for i in range(n)]
    fcf_np     = [_pct(fcff[i], np[i])    for i in range(n)]

    def r(vals):
        return [_round_val(v) for v in vals]

    def p(vals):
        return [round(v, 1) if v is not None else None for v in vals]

    rows = [
        {"label": "Cash from Operating Activity (CFO)", "type": "bold",   "values": r(cfo), "has_ltm": False},
        {"label": "% Growth YoY",       "type": "italic", "values": p(cfo_yoy)},
        {"label": "Cash from Investing Activity", "type": "normal", "values": r(cfi), "has_ltm": False},
        {"label": "Cash from Financing Activity", "type": "normal", "values": r(cff), "has_ltm": False},
        {"label": "Net Cash Flow",      "type": "bold",   "values": ncf, "has_ltm": False},
        {"label": "CFO/Sales",          "type": "italic", "values": p(cfo_sales)},
        {"label": "CFO/Net Profit",     "type": "italic", "values": p(cfo_np)},
        {"label": "CFO/EBITDA",         "type": "italic", "values": p(cfo_ebitda)},
        {"label": "Capex",              "type": "normal", "values": r(capex), "has_ltm": False},
        {"label": "FCFF",               "type": "normal", "values": fcff, "has_ltm": False},
        {"label": "Average FCF (3 Years)","type": "normal","values": avg_fcf, "has_ltm": False},
        {"label": "FCF Growth YoY",     "type": "italic", "values": p(fcf_yoy)},
        {"label": "FCF/Sales",          "type": "italic", "values": p(fcf_sales)},
        {"label": "FCF/Net Profit",     "type": "italic", "values": p(fcf_np)},
    ]

    trend_rows = _build_trend_rows(rows, sorted_y)

    return {
        "company_name": company_name,
        "columns": sorted_y,
        "trend_columns": ["9 YEARS", "7 YEARS", "5 YEARS", "3 YEARS"],
        "rows": rows,
        "trend_rows": trend_rows,
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_screener_tables(financials: dict, quarterly_data: dict, company_info: dict) -> dict:
    """
    Build all 4 screener-style table views.

    financials:     {income_statement, balance_sheet, cash_flow} dict
    quarterly_data: {quarter_label: {field: value}} dict
    company_info:   company metadata dict (name, current_price, market_cap, shares_outstanding)
    """
    income  = financials.get("income_statement", {})
    bs      = financials.get("balance_sheet", {})
    cf      = financials.get("cash_flow", {})
    shares  = company_info.get("shares_outstanding") if company_info else None

    try:
        quarterly_results = build_quarterly_results(quarterly_data, income, company_info.get("name", "") if company_info else "")
    except Exception as e:
        logger.warning("Failed to build quarterly_results: %s", e)
        quarterly_results = {"company_name": "", "columns": [], "rows": []}

    try:
        profit_loss = build_profit_loss(income, company_info, shares)
    except Exception as e:
        logger.warning("Failed to build profit_loss: %s", e)
        profit_loss = {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    try:
        balance_sheet = build_balance_sheet(bs, income, company_info)
    except Exception as e:
        logger.warning("Failed to build balance_sheet: %s", e)
        balance_sheet = {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    try:
        cash_flow = build_cash_flow(cf, income, company_info)
    except Exception as e:
        logger.warning("Failed to build cash_flow: %s", e)
        cash_flow = {"company_name": "", "columns": [], "rows": [], "trend_columns": [], "trend_rows": []}

    return {
        "quarterly_results": quarterly_results,
        "profit_loss": profit_loss,
        "balance_sheet": balance_sheet,
        "cash_flow": cash_flow,
    }
