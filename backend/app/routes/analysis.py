import json
import time

from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalyzeRequest, ForecastRequest, DCFRequest, RelativeValuationRequest
from app.services import yahoo_finance, financial_analysis, forecasting, dcf_valuation, relative_valuation
from app.services.screener_tables import build_screener_tables

router = APIRouter()


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Full analysis pipeline: fetch data, compute ratios, forecast, DCF, relative valuation."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        time.sleep(1)
        financials = yahoo_finance.get_financials(ticker)
        time.sleep(1)
        prices = yahoo_finance.get_historical_prices(ticker, period="5y")
        ratios = financial_analysis.compute_ratios(financials)
        historical = financial_analysis.compute_historical_metrics(financials)

        # Fetch quarterly data and build screener-style tables
        try:
            quarterly_data = yahoo_finance.get_quarterly_financials(ticker)
        except Exception:
            quarterly_data = {}
        screener_tables = build_screener_tables(financials, quarterly_data, company_info)

        shareholders = []
        try:
            shareholders = yahoo_finance.get_shareholders(ticker)
        except Exception:
            pass

        news = []
        try:
            news = yahoo_finance.get_news(ticker)
        except Exception:
            pass

        dividend_history = []
        try:
            dividend_history = yahoo_finance.get_dividend_history(ticker)
        except Exception:
            pass

        return {
            "company_info": company_info,
            "financials": financials,
            "historical_prices": prices,
            "ratios": ratios,
            "historical_metrics": historical,
            "screener_tables": screener_tables,
            "shareholders": shareholders,
            "news": news,
            "dividend_history": dividend_history,
        }
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=503,
            detail="Yahoo Finance is temporarily unavailable. Please try again in a few seconds."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forecast")
def forecast(req: ForecastRequest):
    """Generate 3-year financial forecast."""
    try:
        ticker = req.ticker.upper().strip()
        financials = yahoo_finance.get_financials(ticker)
        assumptions = {
            k: v for k, v in {
                "revenue_growth_rates": req.revenue_growth_rates,
                "ebitda_margin": req.ebitda_margin,
                "net_margin": req.net_margin,
                "capex_pct_revenue": req.capex_pct_revenue,
                "da_pct_revenue": req.da_pct_revenue,
                "nwc_pct_revenue": req.nwc_pct_revenue,
            }.items() if v is not None
        }
        result = forecasting.build_forecast(financials, assumptions)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dcf")
def dcf(req: DCFRequest):
    """Run DCF valuation model."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        financials = yahoo_finance.get_financials(ticker)
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
        result = dcf_valuation.run_dcf(
            company_info, financials, fc,
            risk_free_rate=req.risk_free_rate,
            equity_risk_premium=req.equity_risk_premium,
            terminal_growth_rate=req.terminal_growth_rate,
            tax_rate=req.tax_rate,
            exit_multiple=req.exit_multiple,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/relative-valuation")
def relative_val(req: RelativeValuationRequest):
    """Run relative valuation with peer comparison."""
    try:
        ticker = req.ticker.upper().strip()
        company_info = yahoo_finance.get_company_info(ticker)
        financials = yahoo_finance.get_financials(ticker)
        ratios = financial_analysis.compute_ratios(financials)
        result = relative_valuation.run_relative_valuation(
            ticker, company_info, financials, ratios, req.peers
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peers/{ticker}")
def get_peers(ticker: str):
    """Get suggested peer companies."""
    try:
        peers = yahoo_finance.get_peer_tickers(ticker.upper().strip())
        return {"ticker": ticker.upper(), "peers": peers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
