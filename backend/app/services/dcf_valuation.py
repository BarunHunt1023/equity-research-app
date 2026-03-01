"""DCF Valuation Model with WACC calculation via CAPM, terminal value, and sensitivity analysis."""

import numpy as np
from app.config import (
    DEFAULT_RISK_FREE_RATE,
    DEFAULT_EQUITY_RISK_PREMIUM,
    DEFAULT_TERMINAL_GROWTH_RATE,
    DEFAULT_TAX_RATE,
    DEFAULT_EXIT_MULTIPLE,
)
from app.services.yahoo_finance import get_risk_free_rate
from app.services.financial_analysis import _get, _get_latest_period


def compute_wacc(
    company_info: dict,
    financials: dict,
    risk_free_rate: float = None,
    equity_risk_premium: float = None,
    tax_rate: float = None,
) -> dict:
    """Calculate Weighted Average Cost of Capital.

    Cost of Equity = Risk-Free Rate + Beta * Equity Risk Premium  (CAPM)
    Cost of Debt = Interest Expense / Total Debt * (1 - Tax Rate)
    WACC = (E/V) * Ke + (D/V) * Kd
    """
    rf = risk_free_rate if risk_free_rate is not None else get_risk_free_rate()
    erp = equity_risk_premium if equity_risk_premium is not None else DEFAULT_EQUITY_RISK_PREMIUM
    t = tax_rate if tax_rate is not None else DEFAULT_TAX_RATE

    beta = company_info.get("beta") or 1.0
    market_cap = company_info.get("market_cap") or 0

    bs_data = financials.get("balance_sheet", {})
    is_data = financials.get("income_statement", {})
    bs_latest = _get_latest_period(bs_data)
    is_latest = _get_latest_period(is_data)

    total_debt = _get(bs_latest, "Total Debt", 0) or 0
    interest_expense = abs(_get(is_latest, "Interest Expense", 0) or 0)

    # Cost of Equity (CAPM)
    cost_of_equity = rf + beta * erp

    # Cost of Debt (after tax)
    if total_debt > 0 and interest_expense > 0:
        cost_of_debt_pretax = interest_expense / total_debt
    else:
        cost_of_debt_pretax = rf + 0.02  # fallback: risk-free + 2% spread
    cost_of_debt = cost_of_debt_pretax * (1 - t)

    # Capital structure weights
    equity_value = market_cap if market_cap > 0 else 1
    total_value = equity_value + total_debt
    weight_equity = equity_value / total_value
    weight_debt = total_debt / total_value

    wacc = weight_equity * cost_of_equity + weight_debt * cost_of_debt

    return {
        "wacc": round(wacc, 4),
        "cost_of_equity": round(cost_of_equity, 4),
        "cost_of_debt_pretax": round(cost_of_debt_pretax, 4),
        "cost_of_debt_after_tax": round(cost_of_debt, 4),
        "risk_free_rate": round(rf, 4),
        "beta": round(beta, 2),
        "equity_risk_premium": round(erp, 4),
        "tax_rate": round(t, 4),
        "weight_equity": round(weight_equity, 4),
        "weight_debt": round(weight_debt, 4),
        "market_cap": market_cap,
        "total_debt": total_debt,
        "interest_expense": interest_expense,
    }


def run_dcf(
    company_info: dict,
    financials: dict,
    forecast: dict,
    risk_free_rate: float = None,
    equity_risk_premium: float = None,
    terminal_growth_rate: float = None,
    tax_rate: float = None,
    exit_multiple: float = None,
) -> dict:
    """Run a complete DCF valuation.

    1. Calculate WACC
    2. Use projected FCFs from forecast
    3. Compute Terminal Value (Gordon Growth + Exit Multiple)
    4. Discount everything back to present
    5. Compute implied share price
    6. Build sensitivity matrix
    """
    tgr = terminal_growth_rate if terminal_growth_rate is not None else DEFAULT_TERMINAL_GROWTH_RATE
    em = exit_multiple if exit_multiple is not None else DEFAULT_EXIT_MULTIPLE

    wacc_result = compute_wacc(company_info, financials, risk_free_rate, equity_risk_premium, tax_rate)
    wacc = wacc_result["wacc"]

    projections = forecast.get("projections", [])
    if not projections:
        return {"error": "No projections available"}

    # Extract FCFs
    fcfs = [p["fcf"] for p in projections]
    last_fcf = fcfs[-1]
    last_ebitda = projections[-1].get("ebitda", last_fcf * 5)
    n_years = len(fcfs)

    # Discount projected FCFs
    discounted_fcfs = []
    for i, fcf in enumerate(fcfs):
        discount_factor = 1 / (1 + wacc) ** (i + 1)
        pv = fcf * discount_factor
        discounted_fcfs.append({
            "year": i + 1,
            "fcf": round(fcf, 0),
            "discount_factor": round(discount_factor, 4),
            "present_value": round(pv, 0),
        })

    pv_fcfs = sum(d["present_value"] for d in discounted_fcfs)

    # Terminal Value — Gordon Growth Model
    if wacc > tgr:
        tv_gordon = last_fcf * (1 + tgr) / (wacc - tgr)
    else:
        tv_gordon = last_fcf * 25  # fallback

    # Terminal Value — Exit Multiple
    tv_exit = last_ebitda * em

    # Use average of both methods
    terminal_value = (tv_gordon + tv_exit) / 2

    # Discount terminal value
    tv_discount_factor = 1 / (1 + wacc) ** n_years
    pv_terminal = terminal_value * tv_discount_factor

    # Enterprise Value
    enterprise_value = pv_fcfs + pv_terminal

    # Equity Value
    bs_latest = _get_latest_period(financials.get("balance_sheet", {}))
    total_debt = _get(bs_latest, "Total Debt", 0) or 0
    cash = _get(bs_latest, "Cash And Cash Equivalents", 0) or 0
    net_debt = total_debt - cash

    equity_value = enterprise_value - net_debt

    # Per share
    shares = company_info.get("shares_outstanding") or 1
    implied_price = equity_value / shares
    current_price = company_info.get("current_price") or 0
    upside = ((implied_price / current_price) - 1) if current_price > 0 else None

    # Sensitivity matrix: WACC vs Terminal Growth Rate
    sensitivity = _build_sensitivity_matrix(
        fcfs, last_fcf, last_ebitda, em, net_debt, shares, n_years, wacc
    )

    return {
        "wacc": wacc_result,
        "projected_fcfs": discounted_fcfs,
        "pv_of_fcfs": round(pv_fcfs, 0),
        "terminal_value": {
            "gordon_growth": round(tv_gordon, 0),
            "exit_multiple": round(tv_exit, 0),
            "blended": round(terminal_value, 0),
            "pv_terminal": round(pv_terminal, 0),
            "terminal_growth_rate": tgr,
            "exit_multiple_used": em,
        },
        "enterprise_value": round(enterprise_value, 0),
        "net_debt": round(net_debt, 0),
        "equity_value": round(equity_value, 0),
        "shares_outstanding": shares,
        "implied_share_price": round(implied_price, 2),
        "current_price": current_price,
        "upside_downside": round(upside, 4) if upside is not None else None,
        "sensitivity": sensitivity,
    }


def _build_sensitivity_matrix(
    fcfs, last_fcf, last_ebitda, exit_multiple, net_debt, shares, n_years, base_wacc
):
    """Build a WACC vs Terminal Growth Rate sensitivity matrix for implied share price."""
    wacc_range = [round(base_wacc + delta, 4) for delta in [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02]]
    tgr_range = [0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04]

    # Filter out invalid WACC values
    wacc_range = [w for w in wacc_range if w > 0.02]

    matrix = []
    for w in wacc_range:
        row = {"wacc": round(w, 4), "values": []}
        for tg in tgr_range:
            try:
                # Discount FCFs
                pv = sum(fcf / (1 + w) ** (i + 1) for i, fcf in enumerate(fcfs))
                # Terminal value (Gordon)
                if w > tg:
                    tv_g = last_fcf * (1 + tg) / (w - tg)
                else:
                    tv_g = last_fcf * 25
                tv_e = last_ebitda * exit_multiple
                tv = (tv_g + tv_e) / 2
                pv_tv = tv / (1 + w) ** n_years
                ev = pv + pv_tv
                eq = ev - net_debt
                price = eq / shares if shares else 0
                row["values"].append(round(price, 2))
            except Exception:
                row["values"].append(None)
        matrix.append(row)

    return {
        "wacc_values": [round(w, 4) for w in wacc_range],
        "tgr_values": tgr_range,
        "matrix": matrix,
    }
