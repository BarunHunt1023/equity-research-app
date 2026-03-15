from pydantic import BaseModel
from typing import Optional


class AnalyzeRequest(BaseModel):
    ticker: str


class ForecastRequest(BaseModel):
    ticker: str
    revenue_growth_rates: Optional[list[float]] = None  # e.g. [0.08, 0.07, 0.06]
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None
    capex_pct_revenue: Optional[float] = None
    da_pct_revenue: Optional[float] = None
    nwc_pct_revenue: Optional[float] = None


class DCFRequest(BaseModel):
    ticker: str
    risk_free_rate: Optional[float] = None
    equity_risk_premium: Optional[float] = None
    terminal_growth_rate: Optional[float] = None
    tax_rate: Optional[float] = None
    exit_multiple: Optional[float] = None
    revenue_growth_rates: Optional[list[float]] = None
    ebitda_margin: Optional[float] = None
    capex_pct_revenue: Optional[float] = None
    da_pct_revenue: Optional[float] = None
    nwc_pct_revenue: Optional[float] = None


class RelativeValuationRequest(BaseModel):
    ticker: str
    peers: Optional[list[str]] = None


class ReportRequest(BaseModel):
    ticker: str
    risk_free_rate: Optional[float] = None
    equity_risk_premium: Optional[float] = None
    terminal_growth_rate: Optional[float] = None
    tax_rate: Optional[float] = None
    exit_multiple: Optional[float] = None
    revenue_growth_rates: Optional[list[float]] = None
    ebitda_margin: Optional[float] = None
    capex_pct_revenue: Optional[float] = None
    da_pct_revenue: Optional[float] = None
    nwc_pct_revenue: Optional[float] = None
    peers: Optional[list[str]] = None


class PrimerStep1Request(BaseModel):
    ticker: str
    company_info: Optional[dict] = None
    ratios: Optional[dict] = None


class PrimerStep2Request(BaseModel):
    ticker: str
    company_research: str
    company_info: Optional[dict] = None


class PrimerStep3Request(BaseModel):
    ticker: str
    company_research: str
    industry_research: str


class PrimerStep4Request(BaseModel):
    primer_draft: str
    company_name: str = "the company"
