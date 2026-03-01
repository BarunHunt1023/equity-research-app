"""Relative Valuation using peer company multiples."""

import numpy as np
from app.services.yahoo_finance import get_peer_tickers, get_peer_data


def _median(values: list) -> float | None:
    clean = [v for v in values if v is not None and isinstance(v, (int, float)) and not np.isnan(v)]
    if not clean:
        return None
    return float(np.median(clean))


def _mean(values: list) -> float | None:
    clean = [v for v in values if v is not None and isinstance(v, (int, float)) and not np.isnan(v)]
    if not clean:
        return None
    return float(np.mean(clean))


def run_relative_valuation(
    ticker: str,
    company_info: dict,
    financials: dict,
    ratios: dict,
    peer_tickers: list[str] = None,
) -> dict:
    """Run a relative valuation analysis.

    1. Fetch peer company multiples
    2. Compute median/mean for each multiple
    3. Apply peer medians to target company metrics -> implied values
    4. Build football field chart data
    """
    if not peer_tickers:
        peer_tickers = get_peer_tickers(ticker)

    peer_data = get_peer_data(peer_tickers)
    if not peer_data:
        return {"error": "Could not fetch peer data", "peers": []}

    # Target company metrics
    raw = ratios.get("raw_values", {})
    target_eps = None
    shares = company_info.get("shares_outstanding")
    net_income = raw.get("net_income")
    if shares and net_income:
        target_eps = net_income / shares

    target_metrics = {
        "earnings_per_share": target_eps,
        "book_value_per_share": (raw.get("equity") / shares) if shares and raw.get("equity") else None,
        "revenue_per_share": (raw.get("revenue") / shares) if shares and raw.get("revenue") else None,
        "ebitda": raw.get("ebitda"),
        "revenue": raw.get("revenue"),
    }

    current_price = company_info.get("current_price", 0) or 0
    enterprise_value = company_info.get("enterprise_value", 0) or 0

    # Extract multiples from peers
    pe_values = [p.get("trailing_pe") for p in peer_data]
    pb_values = [p.get("price_to_book") for p in peer_data]
    ps_values = [p.get("price_to_sales") for p in peer_data]
    ev_ebitda_values = [p.get("ev_to_ebitda") for p in peer_data]
    ev_rev_values = [p.get("ev_to_revenue") for p in peer_data]

    # Compute peer summary statistics
    multiples_summary = {
        "pe": {"median": _median(pe_values), "mean": _mean(pe_values), "values": pe_values},
        "pb": {"median": _median(pb_values), "mean": _mean(pb_values), "values": pb_values},
        "ps": {"median": _median(ps_values), "mean": _mean(ps_values), "values": ps_values},
        "ev_ebitda": {"median": _median(ev_ebitda_values), "mean": _mean(ev_ebitda_values), "values": ev_ebitda_values},
        "ev_revenue": {"median": _median(ev_rev_values), "mean": _mean(ev_rev_values), "values": ev_rev_values},
    }

    # Implied valuations
    implied = {}

    # P/E implied price
    if target_metrics["earnings_per_share"] and target_metrics["earnings_per_share"] > 0:
        eps = target_metrics["earnings_per_share"]
        pe_med = multiples_summary["pe"]["median"]
        if pe_med:
            implied["pe"] = {
                "label": "P/E",
                "implied_price": round(eps * pe_med, 2),
                "multiple_used": round(pe_med, 2),
                "metric_value": round(eps, 2),
            }

    # P/B implied price
    if target_metrics["book_value_per_share"] and target_metrics["book_value_per_share"] > 0:
        bvps = target_metrics["book_value_per_share"]
        pb_med = multiples_summary["pb"]["median"]
        if pb_med:
            implied["pb"] = {
                "label": "P/B",
                "implied_price": round(bvps * pb_med, 2),
                "multiple_used": round(pb_med, 2),
                "metric_value": round(bvps, 2),
            }

    # P/S implied price
    if target_metrics["revenue_per_share"] and target_metrics["revenue_per_share"] > 0:
        rps = target_metrics["revenue_per_share"]
        ps_med = multiples_summary["ps"]["median"]
        if ps_med:
            implied["ps"] = {
                "label": "P/S",
                "implied_price": round(rps * ps_med, 2),
                "multiple_used": round(ps_med, 2),
                "metric_value": round(rps, 2),
            }

    # EV/EBITDA implied price
    if target_metrics["ebitda"] and target_metrics["ebitda"] > 0 and shares:
        ebitda = target_metrics["ebitda"]
        ev_ebitda_med = multiples_summary["ev_ebitda"]["median"]
        if ev_ebitda_med:
            implied_ev = ebitda * ev_ebitda_med
            net_debt = (enterprise_value - (current_price * shares)) if enterprise_value else 0
            implied_eq = implied_ev - net_debt
            implied["ev_ebitda"] = {
                "label": "EV/EBITDA",
                "implied_price": round(implied_eq / shares, 2),
                "multiple_used": round(ev_ebitda_med, 2),
                "metric_value": round(ebitda, 0),
            }

    # EV/Revenue implied price
    if target_metrics["revenue"] and target_metrics["revenue"] > 0 and shares:
        rev = target_metrics["revenue"]
        ev_rev_med = multiples_summary["ev_revenue"]["median"]
        if ev_rev_med:
            implied_ev = rev * ev_rev_med
            net_debt = (enterprise_value - (current_price * shares)) if enterprise_value else 0
            implied_eq = implied_ev - net_debt
            implied["ev_revenue"] = {
                "label": "EV/Revenue",
                "implied_price": round(implied_eq / shares, 2),
                "multiple_used": round(ev_rev_med, 2),
                "metric_value": round(rev, 0),
            }

    # Football field data
    football_field = _build_football_field(implied, current_price)

    # Target company's own multiples for comparison
    target_multiples = {
        "pe": company_info.get("trailing_pe"),
        "forward_pe": company_info.get("forward_pe"),
        "pb": round(current_price / target_metrics["book_value_per_share"], 2) if target_metrics["book_value_per_share"] and target_metrics["book_value_per_share"] > 0 else None,
        "ps": round(current_price / target_metrics["revenue_per_share"], 2) if target_metrics["revenue_per_share"] and target_metrics["revenue_per_share"] > 0 else None,
        "ev_ebitda": round(enterprise_value / target_metrics["ebitda"], 2) if target_metrics["ebitda"] and target_metrics["ebitda"] > 0 and enterprise_value else None,
        "ev_revenue": round(enterprise_value / target_metrics["revenue"], 2) if target_metrics["revenue"] and target_metrics["revenue"] > 0 and enterprise_value else None,
    }

    return {
        "peers": peer_data,
        "multiples_summary": {
            k: {"median": round(v["median"], 2) if v["median"] else None,
                "mean": round(v["mean"], 2) if v["mean"] else None}
            for k, v in multiples_summary.items()
        },
        "target_multiples": target_multiples,
        "implied_valuations": implied,
        "football_field": football_field,
        "current_price": current_price,
    }


def _build_football_field(implied: dict, current_price: float) -> list[dict]:
    """Build football field chart data showing valuation range for each method."""
    field = []
    all_prices = []

    for key, val in implied.items():
        price = val["implied_price"]
        all_prices.append(price)
        # Create a range: ±15% around implied price
        low = round(price * 0.85, 2)
        high = round(price * 1.15, 2)
        field.append({
            "method": val["label"],
            "low": low,
            "mid": price,
            "high": high,
        })

    # Add a blended/composite range
    if all_prices:
        avg_price = round(sum(all_prices) / len(all_prices), 2)
        field.append({
            "method": "Composite",
            "low": round(min(all_prices), 2),
            "mid": avg_price,
            "high": round(max(all_prices), 2),
        })

    return field
