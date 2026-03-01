"""AI-Enhanced Equity Research Report Generator using Claude API."""

import json
from app.config import ANTHROPIC_API_KEY

try:
    import anthropic
except ImportError:
    anthropic = None


def _format_number(n, decimals=1):
    if n is None:
        return "N/A"
    if abs(n) >= 1e12:
        return f"${n/1e12:,.{decimals}f}T"
    if abs(n) >= 1e9:
        return f"${n/1e9:,.{decimals}f}B"
    if abs(n) >= 1e6:
        return f"${n/1e6:,.{decimals}f}M"
    return f"${n:,.{decimals}f}"


def _format_pct(n):
    if n is None:
        return "N/A"
    return f"{n*100:.1f}%"


def _build_data_summary(company_info, ratios, forecast, dcf, relative_val):
    """Build a structured text summary of all financial data for the AI prompt."""
    lines = []
    lines.append(f"Company: {company_info.get('name', 'Unknown')} ({company_info.get('ticker', '')})")
    lines.append(f"Sector: {company_info.get('sector', 'N/A')} | Industry: {company_info.get('industry', 'N/A')}")
    lines.append(f"Current Price: ${company_info.get('current_price', 0):.2f}")
    lines.append(f"Market Cap: {_format_number(company_info.get('market_cap'))}")
    lines.append(f"Beta: {company_info.get('beta', 'N/A')}")
    lines.append("")

    # Profitability
    prof = ratios.get("profitability", {})
    lines.append("KEY RATIOS:")
    lines.append(f"  Gross Margin: {_format_pct(prof.get('gross_margin'))}")
    lines.append(f"  EBITDA Margin: {_format_pct(prof.get('ebitda_margin'))}")
    lines.append(f"  Net Margin: {_format_pct(prof.get('net_margin'))}")
    lines.append(f"  ROE: {_format_pct(prof.get('roe'))}")
    lines.append(f"  ROIC: {_format_pct(prof.get('roic'))}")

    # Solvency
    solv = ratios.get("solvency", {})
    lines.append(f"  D/E: {solv.get('debt_to_equity', 'N/A')}")
    lines.append(f"  Interest Coverage: {solv.get('interest_coverage', 'N/A')}x")
    lines.append("")

    # Forecast
    if forecast and forecast.get("projections"):
        lines.append("3-YEAR FORECAST:")
        for p in forecast["projections"]:
            lines.append(f"  Year {p['year']}: Revenue {_format_number(p['revenue'])} "
                        f"(+{_format_pct(p['revenue_growth'])}), "
                        f"EBITDA {_format_number(p['ebitda'])}, "
                        f"FCF {_format_number(p['fcf'])}")
        lines.append("")

    # DCF
    if dcf and not dcf.get("error"):
        lines.append("DCF VALUATION:")
        lines.append(f"  WACC: {_format_pct(dcf.get('wacc', {}).get('wacc'))}")
        lines.append(f"  Enterprise Value: {_format_number(dcf.get('enterprise_value'))}")
        lines.append(f"  Implied Share Price: ${dcf.get('implied_share_price', 0):.2f}")
        up = dcf.get("upside_downside")
        if up is not None:
            lines.append(f"  Upside/Downside: {_format_pct(up)}")
        lines.append("")

    # Relative Valuation
    if relative_val and not relative_val.get("error"):
        lines.append("RELATIVE VALUATION (Peer Median Multiples):")
        for key, val in relative_val.get("implied_valuations", {}).items():
            lines.append(f"  {val['label']}: ${val['implied_price']:.2f} "
                        f"(using {val['multiple_used']}x)")
        lines.append("")

    return "\n".join(lines)


def generate_report(
    company_info: dict,
    financials: dict,
    ratios: dict,
    historical_metrics: list,
    forecast: dict,
    dcf: dict,
    relative_val: dict,
) -> dict:
    """Generate an AI-enhanced equity research report."""
    data_summary = _build_data_summary(company_info, ratios, forecast, dcf, relative_val)

    # Compute composite target price
    prices = []
    if dcf and dcf.get("implied_share_price"):
        prices.append(dcf["implied_share_price"])
    if relative_val:
        for v in relative_val.get("implied_valuations", {}).values():
            if v.get("implied_price"):
                prices.append(v["implied_price"])
    target_price = round(sum(prices) / len(prices), 2) if prices else None
    current_price = company_info.get("current_price", 0)

    # Determine recommendation
    if target_price and current_price:
        upside = (target_price / current_price) - 1
        if upside > 0.15:
            recommendation = "BUY"
        elif upside > -0.05:
            recommendation = "HOLD"
        else:
            recommendation = "SELL"
    else:
        recommendation = "HOLD"
        upside = 0

    # Try AI-generated narrative
    narrative = _generate_ai_narrative(data_summary, company_info, recommendation)

    return {
        "company": company_info,
        "recommendation": recommendation,
        "target_price": target_price,
        "current_price": current_price,
        "upside_pct": round(upside, 4) if upside else None,
        "narrative": narrative,
        "ratios": ratios,
        "historical_metrics": historical_metrics,
        "forecast": forecast,
        "dcf": dcf,
        "relative_valuation": relative_val,
    }


def _generate_ai_narrative(data_summary: str, company_info: dict, recommendation: str) -> dict:
    """Generate narrative sections using Claude API."""
    if not ANTHROPIC_API_KEY or not anthropic:
        return _generate_template_narrative(company_info, recommendation)

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        prompt = f"""You are a senior equity research analyst. Based on the following financial data,
write a professional equity research report narrative. Be specific with numbers and provide
actionable insights.

{data_summary}

Please provide the following sections in JSON format:
{{
    "executive_summary": "2-3 paragraph executive summary with key findings and recommendation",
    "investment_thesis": {{
        "bull_case": "3-4 bullet points for the bull case",
        "base_case": "3-4 bullet points for the base case",
        "bear_case": "3-4 bullet points for the bear case"
    }},
    "business_overview": "2-3 paragraphs about the company's business, competitive position, and market",
    "financial_highlights": "2-3 paragraphs analyzing the key financial metrics and trends",
    "risk_factors": "4-5 key risk factors with brief explanations",
    "catalysts": "3-4 potential catalysts that could drive the stock price"
}}

Respond ONLY with the JSON object, no additional text."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )

        text = message.content[0].text.strip()
        # Try to parse the JSON response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        return _generate_template_narrative(company_info, recommendation)


def _generate_template_narrative(company_info: dict, recommendation: str) -> dict:
    """Fallback template-based narrative when AI is unavailable."""
    name = company_info.get("name", "The company")
    sector = company_info.get("sector", "its sector")
    price = company_info.get("current_price", 0)

    return {
        "executive_summary": (
            f"{name} operates in the {sector} sector. Based on our comprehensive analysis "
            f"including DCF valuation and relative peer comparison, we rate the stock as "
            f"{recommendation} at the current price of ${price:.2f}. "
            f"Our analysis considers both quantitative financial metrics and qualitative "
            f"factors including competitive positioning and industry dynamics."
        ),
        "investment_thesis": {
            "bull_case": (
                f"Strong revenue growth trajectory with expanding margins. "
                f"Market leadership position in {sector}. "
                f"Potential for multiple expansion as growth accelerates."
            ),
            "base_case": (
                f"Steady growth in line with industry averages. "
                f"Maintained market share with stable margins. "
                f"Valuation fairly reflects current fundamentals."
            ),
            "bear_case": (
                f"Competitive pressure could erode margins. "
                f"Macroeconomic headwinds may slow growth. "
                f"Potential for multiple compression if growth disappoints."
            ),
        },
        "business_overview": (
            f"{name} is a {sector} company. Please configure the ANTHROPIC_API_KEY "
            f"environment variable to enable AI-powered detailed business analysis."
        ),
        "financial_highlights": (
            f"Review the quantitative sections below for detailed financial metrics, "
            f"historical trends, and projected financials."
        ),
        "risk_factors": (
            "Key risks include: market competition, regulatory changes, "
            "macroeconomic conditions, execution risk, and technology disruption."
        ),
        "catalysts": (
            "Potential catalysts include: new product launches, market expansion, "
            "strategic partnerships, and favorable regulatory developments."
        ),
    }
