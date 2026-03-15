"""AI-Enhanced Equity Research Report Generator using Claude API — 4-Step Business Primer."""

import json
import time
import datetime
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


# ---------------------------------------------------------------------------
# Individual step functions — each runs one Claude API call
# ---------------------------------------------------------------------------

def _claude(prompt: str, max_tokens: int) -> str:
    """Helper: run a single Claude API call and return the text response.

    Uses the SDK's built-in retry mechanism (max_retries=5) which honours the
    retry-after header returned by the API on 429 rate-limit responses.
    Falls back to a manual 60-second wait if the SDK retries are exhausted.
    """
    if not anthropic:
        raise ValueError(
            "The 'anthropic' Python package is not installed. "
            "Run: pip install anthropic"
        )
    if not ANTHROPIC_API_KEY:
        raise ValueError(
            "ANTHROPIC_API_KEY is not configured. "
            "Please set this environment variable to generate AI-powered reports."
        )
    # max_retries=5 lets the SDK handle 429/529 with proper retry-after timing
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, max_retries=5)
    try:
        msg = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except anthropic.RateLimitError:
        # All SDK retries exhausted — wait 60 s and try once more
        time.sleep(60)
        try:
            msg = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text.strip()
        except anthropic.RateLimitError:
            raise  # re-raise so the route handler converts it to HTTP 429


def step1_company_research(company_info: dict, ratios: dict) -> str:
    """Call 1 — Company Research (max_tokens=4000)."""
    data_summary = _build_data_summary(company_info, ratios, None, None, None)
    name = company_info.get("name", "the company")
    ticker = company_info.get("ticker", "")

    prompt = f"""You are a senior investment analyst. Conduct deep research on {name} ({ticker}).

Financial context already computed by the research platform:
{data_summary}

Analyze and write in detailed prose:
(1) Business model — how it makes money, all revenue streams and their % mix, pricing model, recurring vs transactional revenue.
(2) Cost structure — major cost categories, gross/operating/net margins for last 3 years, fixed vs variable costs, operating leverage.
(3) Cash flow profile — FCF margin, FCF conversion, capital intensity, balance sheet strength.
(4) Cyclicality — macro sensitivity, seasonality, performance in downturns.
(5) Competitive moat — moat type (network effects/switching costs/cost advantages/intangibles), evidence for it, top 3 competitors compared on key metrics.
(6) Growth vectors — TAM, penetration, organic vs acquisition growth, next 3-5 year drivers.
(7) Top 5 risks with likelihood and severity.

Write 8-10 pages of investor-grade prose. Cite sources. No bullet dumps. No fluff."""

    return _claude(prompt, max_tokens=4000)


def step2_industry_research(company_info: dict, company_research: str) -> str:
    """Call 2 — Industry Research (max_tokens=4000)."""
    name = company_info.get("name", "the company")

    prompt = f"""You are a senior industry analyst. Based on the company research below, identify the industry {name} operates in and conduct deep research on it.

COMPANY RESEARCH:
{company_research}

Analyze:
(1) Industry definition and market size.
(2) Full value chain map — where value is created vs captured, where {name} sits.
(3) Profit pool — who makes money and why, which segments have highest margins.
(4) Competitive landscape — fragmented or consolidated, top 10 players, consolidation trend.
(5) Barriers to entry — capital, regulatory, scale, network effects, brand.
(6) Demand drivers — structural forces, historical and forecast CAGR with sources.
(7) Regulatory environment — key regulations, recent changes, pending risks.
(8) Technology disruption risk — AI, platforms, new business models threatening incumbents.

Write 6-8 pages of investor-grade prose. Cite sources."""

    return _claude(prompt, max_tokens=4000)


def step3_synthesis(company_info: dict, company_research: str, industry_research: str) -> str:
    """Call 3 — Synthesis into 16-page primer (max_tokens=6000)."""
    name = company_info.get("name", "the company")

    prompt = f"""Using the company research and industry research below, write a single coherent 16-page Business & Industry Primer for {name} with these exact sections:

(1) Executive Summary — 3-5 paragraphs, standalone mental model of the business.
(2) How The Business Actually Works — revenue architecture, cost structure, cash flow story, one dollar of revenue walkthrough.
(3) The Industry Context — value chain position, competitive landscape, profit pool, demand drivers, barriers to entry.
(4) Competitive Position & Moat — moat type with evidence, comparison to top 3 rivals on revenue/margins/growth/ROIC, strengthening or eroding?
(5) Growth — primary vectors, TAM runway, capital allocation priorities.
(6) Risks — top 5 risks with likelihood (low/medium/high) and severity (low/medium/high).
(7) Key Financial Metrics — table of Revenue, Revenue Growth%, Gross Margin%, Operating Margin%, Net Margin%, FCF, FCF Margin%, ROIC%, Net Debt/EBITDA for last 3 fiscal years.
(8) What An Investor Must Understand — 3-5 original insights that unlock understanding of this business.

Tone: clear, precise, investor-grade. No hedging. No AI-speak. Cite key numbers.

COMPANY RESEARCH:
{company_research}

INDUSTRY RESEARCH:
{industry_research}"""

    return _claude(prompt, max_tokens=6000)


def step4_factcheck(primer_draft: str, company_name: str) -> str:
    """Call 4 — Fact-check and finalize the primer (max_tokens=4000)."""
    today = datetime.date.today().strftime("%Y-%m-%d")

    prompt = f"""Review this Business & Industry Primer for {company_name} and fact-check it.

For every financial number: verify it is correctly attributed to the right fiscal year.
For every market size or CAGR: flag if source is secondary only.
For every competitive claim: check if it has quantitative backing.
Mark unverified items with [UNVERIFIED].
Mark estimates with [ESTIMATED].
Mark company-stated-only claims with [COMPANY-STATED].
Correct any internal inconsistencies between sections.
Add a footnote at the end: "Fact-check completed {today}. X figures verified. Y items flagged."

Return the corrected final report as clean markdown text, preserving all headings and section structure.

PRIMER DRAFT:
{primer_draft}"""

    return _claude(prompt, max_tokens=4000)


# ---------------------------------------------------------------------------
# Full 4-step pipeline (used by the legacy /report endpoint)
# ---------------------------------------------------------------------------

def _generate_business_primer(company_info: dict, ratios: dict) -> dict:
    """Run all 4 sequential Claude calls and return the final business primer."""
    if not ANTHROPIC_API_KEY or not anthropic:
        return _fallback_primer(company_info)

    try:
        company_research = step1_company_research(company_info, ratios)
        industry_research = step2_industry_research(company_info, company_research)
        primer_draft = step3_synthesis(company_info, company_research, industry_research)
        name = company_info.get("name", "the company")
        final = step4_factcheck(primer_draft, name)
        return {"business_primer": final}
    except Exception:
        return _fallback_primer(company_info)


def _fallback_primer(company_info: dict) -> dict:
    """Template fallback when API key is not configured."""
    name = company_info.get("name", "The company")
    sector = company_info.get("sector", "its sector")
    return {
        "business_primer": (
            f"# Business & Industry Primer: {name}\n\n"
            f"## Executive Summary\n\n"
            f"{name} operates in the {sector} sector.\n\n"
            f"> **Note:** Configure the `ANTHROPIC_API_KEY` environment variable to generate "
            f"a full AI-powered 16-page Business & Industry Primer."
        )
    }


# ---------------------------------------------------------------------------
# Main generate_report entry point (kept for route compatibility)
# ---------------------------------------------------------------------------

def generate_report(
    company_info: dict,
    financials: dict,
    ratios: dict,
    historical_metrics: list,
    forecast: dict,
    dcf: dict,
    relative_val: dict,
) -> dict:
    """Generate a Business & Industry Primer report."""
    primer = _generate_business_primer(company_info, ratios)

    # Compute composite target price (kept for reference in the response)
    prices = []
    if dcf and dcf.get("implied_share_price"):
        prices.append(dcf["implied_share_price"])
    if relative_val:
        for v in relative_val.get("implied_valuations", {}).values():
            if v.get("implied_price"):
                prices.append(v["implied_price"])
    target_price = round(sum(prices) / len(prices), 2) if prices else None
    current_price = company_info.get("current_price", 0)

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

    return {
        "company": company_info,
        "recommendation": recommendation,
        "target_price": target_price,
        "current_price": current_price,
        "upside_pct": round(upside, 4) if upside else None,
        "business_primer": primer.get("business_primer", ""),
        "ratios": ratios,
        "historical_metrics": historical_metrics,
        "forecast": forecast,
        "dcf": dcf,
        "relative_valuation": relative_val,
    }
