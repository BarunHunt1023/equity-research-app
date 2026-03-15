from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ReportRequest,
    PrimerStep1Request,
    PrimerStep2Request,
    PrimerStep3Request,
    PrimerStep4Request,
)
from app.services import (
    yahoo_finance,
    financial_analysis,
    forecasting,
    dcf_valuation,
    relative_valuation,
    report_generator,
)

try:
    import anthropic as _anthropic
except ImportError:
    _anthropic = None

router = APIRouter()


@router.post("/report")
def generate_report(req: ReportRequest):
    """Generate a complete equity research report with AI-enhanced narrative (full pipeline)."""
    try:
        ticker = req.ticker.upper().strip()

        # Fetch all data
        company_info = yahoo_finance.get_company_info(ticker)
        financials = yahoo_finance.get_financials(ticker)
        ratios = financial_analysis.compute_ratios(financials)
        historical = financial_analysis.compute_historical_metrics(financials)

        # Build forecast
        assumptions = {
            k: v for k, v in {
                "revenue_growth_rates": req.revenue_growth_rates,
                "ebitda_margin": req.ebitda_margin,
                "capex_pct_revenue": req.capex_pct_revenue,
                "da_pct_revenue": req.da_pct_revenue,
                "nwc_pct_revenue": req.nwc_pct_revenue,
                "tax_rate": req.tax_rate,
            }.items() if v is not None
        }
        fc = forecasting.build_forecast(financials, assumptions)

        # DCF
        dcf = dcf_valuation.run_dcf(
            company_info, financials, fc,
            risk_free_rate=req.risk_free_rate,
            equity_risk_premium=req.equity_risk_premium,
            terminal_growth_rate=req.terminal_growth_rate,
            tax_rate=req.tax_rate,
            exit_multiple=req.exit_multiple,
        )

        # Relative valuation
        rel_val = relative_valuation.run_relative_valuation(
            ticker, company_info, financials, ratios, req.peers
        )

        # Generate report with Business Primer
        report = report_generator.generate_report(
            company_info, financials, ratios, historical, fc, dcf, rel_val
        )

        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 4-Step Business Primer endpoints — called sequentially by the frontend
# so it can show step-by-step progress
# ---------------------------------------------------------------------------

def _handle_rate_limit(e: Exception):
    """Re-raise rate limit errors as HTTP 429, all others as HTTP 500."""
    if _anthropic and isinstance(e, _anthropic.RateLimitError):
        raise HTTPException(
            status_code=429,
            detail="The AI service is temporarily rate-limited. Please wait a moment and try again.",
        )
    raise HTTPException(status_code=500, detail=str(e))


@router.post("/report/primer/step1")
def primer_step1(req: PrimerStep1Request):
    """Step 1 — Company Research: business model, moat, cost structure, risks."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        financials = yahoo_finance.get_financials(ticker)
        ratios = financial_analysis.compute_ratios(financials)
        result = report_generator.step1_company_research(company_info, ratios)
        return {
            "company_research": result,
            "company_name": company_info.get("name", ticker),
        }
    except Exception as e:
        _handle_rate_limit(e)


@router.post("/report/primer/step2")
def primer_step2(req: PrimerStep2Request):
    """Step 2 — Industry Research: value chain, competitive landscape, demand drivers."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        result = report_generator.step2_industry_research(company_info, req.company_research)
        return {"industry_research": result}
    except Exception as e:
        _handle_rate_limit(e)


@router.post("/report/primer/step3")
def primer_step3(req: PrimerStep3Request):
    """Step 3 — Synthesis: combine research into a coherent 16-page primer draft."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        result = report_generator.step3_synthesis(
            company_info, req.company_research, req.industry_research
        )
        return {"primer_draft": result}
    except Exception as e:
        _handle_rate_limit(e)


@router.post("/report/primer/step4")
def primer_step4(req: PrimerStep4Request):
    """Step 4 — Fact-check: verify numbers, flag estimates, return final primer."""
    try:
        result = report_generator.step4_factcheck(req.primer_draft, req.company_name)
        return {"business_primer": result}
    except Exception as e:
        _handle_rate_limit(e)
