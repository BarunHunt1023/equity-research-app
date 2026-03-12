"""Compute key financial ratios and metrics from financial statements."""

import numpy as np


def _get(data: dict, key: str, default=None):
    """Case-insensitive dict lookup across common yfinance field name variants."""
    if not data:
        return default
    # Direct match
    if key in data:
        v = data[key]
        return v if v is not None else default
    # Try common variants
    variants = {
        "Total Revenue": ["Total Revenue", "Revenue", "Net Sales", "Total Net Revenue"],
        "Cost Of Revenue": ["Cost Of Revenue", "Cost of Revenue", "Cost Of Goods Sold", "COGS"],
        "Gross Profit": ["Gross Profit"],
        "Operating Income": ["Operating Income", "EBIT", "Operating Profit"],
        "EBITDA": ["EBITDA", "Normalized EBITDA"],
        "Net Income": ["Net Income", "Net Income Common Stockholders", "Net Income From Continuing Operations"],
        "Total Assets": ["Total Assets"],
        "Total Liabilities Net Minority Interest": ["Total Liabilities Net Minority Interest", "Total Liabilities"],
        "Stockholders Equity": ["Stockholders Equity", "Total Stockholders Equity", "Total Equity Gross Minority Interest"],
        "Current Assets": ["Current Assets", "Total Current Assets"],
        "Current Liabilities": ["Current Liabilities Net Minority Interest", "Current Liabilities", "Total Current Liabilities"],
        "Cash And Cash Equivalents": ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"],
        "Total Debt": ["Total Debt", "Long Term Debt", "Long Term Debt And Capital Lease Obligation"],
        "Interest Expense": ["Interest Expense", "Interest Expense Non Operating"],
        "Income Tax Expense": ["Tax Provision", "Income Tax Expense"],
        "Depreciation And Amortization": ["Depreciation And Amortization", "Reconciled Depreciation"],
        "Capital Expenditure": ["Capital Expenditure"],
        "Operating Cash Flow": ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"],
        "Inventory": ["Inventory"],
        "Accounts Receivable": ["Net Receivables", "Accounts Receivable"],
        "Accounts Payable": ["Accounts Payable", "Current Accrued Expenses"],
    }
    for variant_list in variants.values():
        if key in variant_list or key == variant_list[0]:
            for v in variant_list:
                if v in data and data[v] is not None:
                    return data[v]
    return default


def _safe_div(a, b):
    if a is None or b is None or b == 0:
        return None
    return a / b


def compute_ratios(financials: dict) -> dict:
    """Compute financial ratios from the most recent period's data.
    financials should have 'income_statement', 'balance_sheet', 'cash_flow'
    each mapping date -> {line_item: value}.
    """
    is_data = financials.get("income_statement", {})
    bs_data = financials.get("balance_sheet", {})
    cf_data = financials.get("cash_flow", {})

    # Get the most recent period
    is_latest = _get_latest_period(is_data)
    bs_latest = _get_latest_period(bs_data)
    cf_latest = _get_latest_period(cf_data)

    revenue = _get(is_latest, "Total Revenue")
    cogs = _get(is_latest, "Cost Of Revenue")
    gross_profit = _get(is_latest, "Gross Profit")
    operating_income = _get(is_latest, "Operating Income")
    ebitda = _get(is_latest, "EBITDA")
    net_income = _get(is_latest, "Net Income")
    interest_expense = _get(is_latest, "Interest Expense")
    tax_expense = _get(is_latest, "Income Tax Expense")
    da = _get(is_latest, "Depreciation And Amortization")

    total_assets = _get(bs_latest, "Total Assets")
    total_liabilities = _get(bs_latest, "Total Liabilities Net Minority Interest")
    equity = _get(bs_latest, "Stockholders Equity")
    current_assets = _get(bs_latest, "Current Assets")
    current_liabilities = _get(bs_latest, "Current Liabilities")
    cash = _get(bs_latest, "Cash And Cash Equivalents")
    total_debt = _get(bs_latest, "Total Debt")
    inventory = _get(bs_latest, "Inventory", 0)

    capex = _get(cf_latest, "Capital Expenditure")
    operating_cf = _get(cf_latest, "Operating Cash Flow")

    # If gross_profit not directly available, compute it
    if gross_profit is None and revenue is not None and cogs is not None:
        gross_profit = revenue - abs(cogs)

    # If EBITDA not available, estimate
    if ebitda is None and operating_income is not None and da is not None:
        ebitda = operating_income + abs(da)

    ratios = {
        "profitability": {
            "gross_margin": _safe_div(gross_profit, revenue),
            "ebitda_margin": _safe_div(ebitda, revenue),
            "operating_margin": _safe_div(operating_income, revenue),
            "net_margin": _safe_div(net_income, revenue),
            "roe": _safe_div(net_income, equity),
            "roa": _safe_div(net_income, total_assets),
            "roic": _compute_roic(net_income, tax_expense, interest_expense, total_debt, equity),
        },
        "liquidity": {
            "current_ratio": _safe_div(current_assets, current_liabilities),
            "quick_ratio": _safe_div(
                (current_assets - inventory) if current_assets is not None else None,
                current_liabilities
            ),
            "cash_ratio": _safe_div(cash, current_liabilities),
        },
        "solvency": {
            "debt_to_equity": _safe_div(total_debt, equity),
            "debt_to_assets": _safe_div(total_debt, total_assets),
            "interest_coverage": _safe_div(
                operating_income, abs(interest_expense) if interest_expense else None
            ),
            "net_debt": (total_debt - cash) if total_debt is not None and cash is not None else None,
        },
        "efficiency": {
            "asset_turnover": _safe_div(revenue, total_assets),
            "fcf_yield": _safe_div(
                _compute_fcf(operating_cf, capex),
                _get(bs_latest, "Total Assets")  # using EV would be better
            ),
        },
        "per_share": {},
        "raw_values": {
            "revenue": revenue,
            "gross_profit": gross_profit,
            "ebitda": ebitda,
            "operating_income": operating_income,
            "net_income": net_income,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "equity": equity,
            "total_debt": total_debt,
            "cash": cash,
            "capex": capex,
            "da": da,
            "operating_cf": operating_cf,
            "interest_expense": interest_expense,
            "tax_expense": tax_expense,
        },
    }

    # Round ratio values
    for category in ["profitability", "liquidity", "solvency", "efficiency"]:
        for k, v in ratios[category].items():
            if isinstance(v, float):
                ratios[category][k] = round(v, 4)

    return ratios


def compute_historical_metrics(financials: dict) -> list[dict]:
    """Compute metrics across all available historical periods."""
    is_data = financials.get("income_statement", {})
    bs_data = financials.get("balance_sheet", {})

    periods = sorted(is_data.keys()) if is_data else []
    history = []

    for period in periods:
        is_period = is_data.get(period, {})
        bs_period = bs_data.get(period, {}) if bs_data else {}

        revenue = _get(is_period, "Total Revenue")
        gross_profit = _get(is_period, "Gross Profit")
        operating_income = _get(is_period, "Operating Income")
        ebitda = _get(is_period, "EBITDA")
        net_income = _get(is_period, "Net Income")
        da = _get(is_period, "Depreciation And Amortization")

        if ebitda is None and operating_income is not None and da is not None:
            ebitda = operating_income + abs(da)

        cogs = _get(is_period, "Cost Of Revenue")
        if gross_profit is None and revenue is not None and cogs is not None:
            gross_profit = revenue - abs(cogs)

        history.append({
            "period": period,
            "revenue": revenue,
            "gross_profit": gross_profit,
            "ebitda": ebitda,
            "operating_income": operating_income,
            "net_income": net_income,
            "gross_margin": _safe_div(gross_profit, revenue),
            "ebitda_margin": _safe_div(ebitda, revenue),
            "operating_margin": _safe_div(operating_income, revenue),
            "net_margin": _safe_div(net_income, revenue),
        })

    return history


def _get_latest_period(data: dict) -> dict:
    if not data:
        return {}
    sorted_keys = sorted(data.keys(), reverse=True)
    return data.get(sorted_keys[0], {}) if sorted_keys else {}


def _compute_roic(net_income, tax_expense, interest_expense, debt, equity):
    if net_income is None or debt is None or equity is None:
        return None
    invested_capital = debt + equity
    if invested_capital == 0:
        return None
    nopat = net_income
    if tax_expense is not None and interest_expense is not None:
        ebit = net_income + abs(tax_expense) + abs(interest_expense)
        tax_rate = abs(tax_expense) / (net_income + abs(tax_expense)) if (net_income + abs(tax_expense)) != 0 else 0.21
        nopat = ebit * (1 - tax_rate)
    return nopat / invested_capital


def _compute_fcf(operating_cf, capex):
    if operating_cf is None:
        return None
    capex_val = abs(capex) if capex is not None else 0
    return operating_cf - capex_val
