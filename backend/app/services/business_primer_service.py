"""Business Overview Skill — 4-step sequential Claude API pipeline."""

import datetime
import anthropic
from app.config import get_anthropic_key


def run_business_overview_skill(company_name: str, data_summary: str = "") -> str:
    """Run the 4-step Business Overview Skill and return the final fact-checked primer."""
    client = anthropic.Anthropic(api_key=get_anthropic_key())

    # ------------------------------------------------------------------
    # Step 1 — Company Research
    # ------------------------------------------------------------------
    step1_prompt = (
        f"You are a senior investment analyst at a top-tier fundamental research firm. "
        f"Your job is to produce a thorough, factual, investor-grade research document on {company_name}. "
        f"Use the financial data provided as your starting point, then expand with broader research.\n\n"
        f"FINANCIAL DATA:\n{data_summary}\n\n"
        f"Cover these 10 areas in detailed prose: "
        f"(1) Business Model Overview — what it does, what problem it solves, how the model evolved. "
        f"(2) Revenue Architecture — all streams, % mix, recurring vs transactional, pricing model, growth drivers. "
        f"(3) Customer & Demand — end customers, acquisition channels, concentration, switching costs, churn. "
        f"(4) Cost Structure & Margins — major cost categories, gross/operating/net margins last 3 years, "
        f"fixed vs variable, operating leverage. "
        f"(5) Cash Flow & Capital Allocation — FCF margin, FCF conversion, capital intensity, balance sheet. "
        f"(6) Cyclicality & Seasonality — macro sensitivity, seasonality, downturn performance. "
        f"(7) Competitive Moat — moat type with evidence, top 3-5 competitors compared on key metrics. "
        f"(8) Management & Ownership — CEO tenure, founder-led, insider ownership, capital allocation track record. "
        f"(9) Growth Vectors — next 3-5 year drivers, TAM and penetration, new markets/products. "
        f"(10) Key Risks — top 5 risks with likelihood and severity. "
        f"Write in precise investor-grade prose. No bullet dumps. Cite sources. End with a Key Takeaway paragraph."
    )

    msg1 = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": step1_prompt}],
    )
    company_research = msg1.content[0].text

    # ------------------------------------------------------------------
    # Step 2 — Industry Research
    # ------------------------------------------------------------------
    step2_prompt = (
        f"You are a senior industry analyst. Based on the company research provided, identify the industry "
        f"{company_name} operates in and produce a thorough research document on it. "
        f"Cover: "
        f"(1) Industry Definition & Scope — market size globally and domestically, major sub-segments. "
        f"(2) Value Chain — full map, where value is created vs captured, where {company_name} sits. "
        f"(3) Profit Pool — where money is made, highest margin segments, pool shifting. "
        f"(4) Competitive Landscape — fragmented or consolidated, top 10 players, Porter's Five Forces. "
        f"(5) Barriers to Entry — capital, regulatory, scale, brand, technology, network effects. "
        f"(6) Demand Drivers & Growth — structural forces, historical and forecast CAGR with sources. "
        f"(7) Supply Dynamics — concentration, capacity constraints, supplier pricing power, input cost volatility. "
        f"(8) Regulatory Environment — key bodies, recent changes, pending risks. "
        f"(9) Technology Trends — AI/automation/digitization impact, new business models disrupting incumbents. "
        f"(10) Industry Risks — macro, geopolitical, ESG, obsolescence risk. "
        f"Cite all market size figures. End with an Industry Verdict paragraph.\n\n"
        f"COMPANY RESEARCH:\n{company_research}"
    )

    msg2 = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": step2_prompt}],
    )
    industry_research = msg2.content[0].text

    # ------------------------------------------------------------------
    # Step 3 — Synthesis (16-page primer draft)
    # ------------------------------------------------------------------
    step3_prompt = (
        f"Using the company research and industry research provided, write a single coherent 16-page "
        f"Business & Industry Primer for {company_name} with these exact 8 sections: "
        f"(1) Executive Summary — 3-5 standalone paragraphs giving complete mental model of the business. "
        f"(2) The Business — How It Actually Works — founding logic, revenue architecture walkthrough, "
        f"cost structure, cash flow story. "
        f"(3) The Industry — value chain position, competitive landscape, profit pool, demand drivers, "
        f"barriers to entry. "
        f"(4) Competitive Position & Moat — moat type with evidence, comparison to top 3 rivals on "
        f"revenue/margins/growth/ROIC, strengthening or eroding. "
        f"(5) Growth — primary vectors, TAM runway, capital allocation, what would double revenue in 7 years. "
        f"(6) Risks — top 5 with likelihood and severity ratings. "
        f"(7) Key Financial Metrics Snapshot — table with Revenue, Revenue Growth%, Gross Margin%, "
        f"Operating Margin%, Net Margin%, FCF, FCF Margin%, ROIC%, Net Debt/EBITDA for last 3 fiscal years. "
        f"(8) What An Investor Must Understand — 3-5 original insights. "
        f"Tone: precise, investor-grade. No hedging. No AI-speak. Cite numbers inline. Target 16+ pages.\n\n"
        f"COMPANY RESEARCH:\n{company_research}\n\n"
        f"INDUSTRY RESEARCH:\n{industry_research}"
    )

    msg3 = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        messages=[{"role": "user", "content": step3_prompt}],
    )
    primer_draft = msg3.content[0].text

    # ------------------------------------------------------------------
    # Step 4 — Fact-check & finalise
    # ------------------------------------------------------------------
    today = datetime.date.today().strftime("%Y-%m-%d")
    step4_prompt = (
        f"Review this Business & Industry Primer and fact-check it. "
        f"Flag with [UNVERIFIED] any number without a clear primary source. "
        f"Flag with [ESTIMATED] any figure from analyst estimates. "
        f"Flag with [COMPANY-STATED] any claim based solely on management statements. "
        f"Flag with [RANGE: X-Y] where sources conflict. "
        f"Check internal consistency: do Section 7 numbers match Section 2? "
        f"Is the moat in Section 4 consistent with Section 3? "
        f"Are Section 6 risks consistent with Section 3 industry analysis? "
        f"Correct all errors. Return the complete corrected report. "
        f"Add footnote: Fact-check completed {today}. X figures verified. Y items flagged.\n\n"
        f"PRIMER DRAFT:\n{primer_draft}"
    )

    msg4 = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": step4_prompt}],
    )
    return msg4.content[0].text
