from fastapi import APIRouter, HTTPException
from app.models.schemas import ReportRequest
from app.services import (
    yahoo_finance,
    financial_analysis,
    forecasting,
    dcf_valuation,
    relative_valuation,
    report_generator,
)

router = APIRouter()


@router.post("/report")
def generate_report(req: ReportRequest):
    """Generate a complete equity research report with AI-enhanced narratives."""
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

        # Generate report with AI narrative
        report = report_generator.generate_report(
            company_info, financials, ratios, historical, fc, dcf, rel_val
        )

        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
