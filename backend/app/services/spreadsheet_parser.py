"""Parse CSV and Excel financial data exports (screener.in and generic formats)."""

import os
import re
import pandas as pd
import numpy as np

# screener.in field names → financial_analysis.py compatible names
FIELD_MAP = {
    # Income Statement (screener.in → yfinance-style)
    "Sales": "Total Revenue",
    "Revenue": "Total Revenue",
    "Total Revenue": "Total Revenue",
    "Net Sales": "Total Revenue",
    "Expenses": "Total Expenses",
    "Cost Of Revenue": "Cost Of Revenue",
    "Operating Profit": "Operating Income",
    "EBITDA": "EBITDA",
    "Net Profit": "Net Income",
    "Net Income": "Net Income",
    "Profit before Tax": "Pretax Income",
    "Profit Before Tax": "Pretax Income",
    "Interest": "Interest Expense",
    "Interest Expense": "Interest Expense",
    "Depreciation": "Depreciation And Amortization",
    "Depreciation And Amortization": "Depreciation And Amortization",
    "Tax": "Tax Provision",
    "Income Tax Expense": "Tax Provision",
    "Tax Provision": "Tax Provision",
    "Other Income": "Other Income",
    "EPS": "Basic EPS",
    "EPS in Rs": "Basic EPS",
    "Gross Profit": "Gross Profit",

    # Balance Sheet
    "Equity Share Capital": "Common Stock",
    "Share Capital": "Common Stock",
    "Reserves": "Retained Earnings",
    "Reserves and Surplus": "Retained Earnings",
    "Borrowings": "Total Debt",
    "Total Debt": "Total Debt",
    "Long Term Debt": "Total Debt",
    "Other Liabilities": "Other Liabilities",
    "Total Liabilities": "Total Liabilities Net Minority Interest",
    "Total": "Total Assets",
    "Total Assets": "Total Assets",
    "Fixed Assets": "Property Plant And Equipment",
    "Property Plant And Equipment": "Property Plant And Equipment",
    "CWIP": "Capital Work In Progress",
    "Investments": "Investments",
    "Other Assets": "Other Assets",
    "Cash and Cash Equivalents": "Cash And Cash Equivalents",
    "Cash & Short Term Investments": "Cash And Cash Equivalents",
    "Current Assets": "Current Assets",
    "Total Current Assets": "Current Assets",
    "Current Liabilities": "Current Liabilities",
    "Total Current Liabilities": "Current Liabilities",
    "Stockholders Equity": "Stockholders Equity",
    "Total Stockholders Equity": "Stockholders Equity",
    "Inventory": "Inventory",
    "Accounts Receivable": "Net Receivables",
    "Trade Receivables": "Net Receivables",

    # Cash Flow
    "Cash from Operating Activity": "Operating Cash Flow",
    "Cash from Operating Activities": "Operating Cash Flow",
    "Operating Cash Flow": "Operating Cash Flow",
    "Cash from Investing Activity": "Cash From Investing",
    "Cash from Investing Activities": "Cash From Investing",
    "Cash from Financing Activity": "Cash From Financing",
    "Cash from Financing Activities": "Cash From Financing",
    "Net Cash Flow": "Net Cash Flow",
    "Capital Expenditure": "Capital Expenditure",
    "Free Cash Flow": "Free Cash Flow",
}

# Keywords for auto-classifying a CSV as IS/BS/CF
IS_KEYWORDS = ["revenue", "sales", "net income", "net profit", "operating profit", "ebitda", "eps", "profit before tax"]
BS_KEYWORDS = ["total assets", "borrowings", "equity share", "reserves", "fixed assets", "current assets", "total liabilities"]
CF_KEYWORDS = ["operating activity", "investing activity", "financing activity", "net cash flow", "capital expenditure"]


def _parse_number(val) -> float | None:
    """Parse a value to float, handling commas, parentheses, percentages."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s or s in ("-", "—", "–", "N/A", "n/a", ""):
        return None
    # Remove percentage sign (OPM%, Tax%, etc. are not useful as raw values)
    if s.endswith("%"):
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    s = s.replace(",", "").replace("$", "").replace("₹", "").strip()
    try:
        num = float(s)
        return -num if negative else num
    except ValueError:
        return None


def _map_field(name: str) -> str:
    """Map a field name to its standardized equivalent."""
    stripped = name.strip()
    if stripped in FIELD_MAP:
        return FIELD_MAP[stripped]
    return stripped


def _classify_content(line_items: list[str]) -> str:
    """Classify a list of line items as income_statement, balance_sheet, or cash_flow."""
    text = " ".join(item.lower() for item in line_items)
    is_score = sum(1 for kw in IS_KEYWORDS if kw in text)
    bs_score = sum(1 for kw in BS_KEYWORDS if kw in text)
    cf_score = sum(1 for kw in CF_KEYWORDS if kw in text)
    best = max(is_score, bs_score, cf_score)
    if best == 0:
        return "unknown"
    if best == is_score:
        return "income_statement"
    if best == bs_score:
        return "balance_sheet"
    return "cash_flow"


def _df_to_financials(df: pd.DataFrame, statement_type: str = None) -> tuple[str, dict]:
    """Convert a DataFrame (rows=line items, columns=periods) to financial dict.

    Returns (statement_type, {period: {line_item: value}}).
    """
    if df is None or df.empty:
        return statement_type or "unknown", {}

    # First column is line item labels, rest are period columns
    df = df.copy()

    # If first column looks like labels (mostly strings), use it as index
    first_col = df.iloc[:, 0]
    if first_col.dtype == object:
        df = df.set_index(df.columns[0])
    else:
        # Already has proper index
        pass

    # Auto-classify if not specified
    if not statement_type:
        line_items = [str(idx) for idx in df.index]
        statement_type = _classify_content(line_items)

    # Build {period: {mapped_line_item: value}} dict
    result = {}
    for col in df.columns:
        period = str(col).strip()
        # Skip percentage columns (OPM%, Tax%, etc.)
        if "%" in period:
            continue
        period_data = {}
        for idx in df.index:
            label = str(idx).strip()
            if not label or label.lower() in ("", "nan"):
                continue
            mapped = _map_field(label)
            val = _parse_number(df.at[idx, col])
            if val is not None:
                period_data[mapped] = val
        if period_data:
            result[period] = period_data

    return statement_type, result


# Sheet name patterns for screener.in and common Excel formats
SHEET_PATTERNS = {
    "income_statement": ["profit & loss", "profit and loss", "income statement", "income", "p&l", "pl"],
    "balance_sheet": ["balance sheet", "bs"],
    "cash_flow": ["cash flow", "cash flows", "cf", "cashflow"],
}


def _match_sheet_type(sheet_name: str) -> str | None:
    """Match a sheet name to a financial statement type."""
    lower = sheet_name.lower().strip()
    for stmt_type, patterns in SHEET_PATTERNS.items():
        for pattern in patterns:
            if pattern in lower:
                return stmt_type
    return None


def parse_excel(filepath: str) -> dict:
    """Parse an Excel file with financial data (screener.in or generic format).

    Returns {income_statement: {...}, balance_sheet: {...}, cash_flow: {...}}.
    """
    sheets = pd.read_excel(filepath, sheet_name=None, header=0)

    financials = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
    }

    for sheet_name, df in sheets.items():
        # Skip metadata/customization sheets
        lower_name = sheet_name.lower().strip()
        if lower_name in ("data sheet", "customization", "quarters", "data"):
            continue
        if df.empty:
            continue

        # Try to match by sheet name first
        stmt_type = _match_sheet_type(sheet_name)

        # Parse the sheet
        classified_type, parsed = _df_to_financials(df, stmt_type)

        if classified_type in financials and parsed:
            financials[classified_type].update(parsed)

    # If only "Data Sheet" exists (some screener.in exports), try to parse it
    if all(not v for v in financials.values()) and "Data Sheet" in sheets:
        _parse_data_sheet(sheets["Data Sheet"], financials)

    return financials


def _parse_data_sheet(df: pd.DataFrame, financials: dict):
    """Parse screener.in's combined 'Data Sheet' which has all statements in sections."""
    if df.empty:
        return

    current_section = None
    section_rows = []

    for _, row in df.iterrows():
        first_cell = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        lower = first_cell.lower()

        # Detect section headers
        if any(kw in lower for kw in ["profit & loss", "profit and loss", "income statement"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "income_statement"
            section_rows = []
            continue
        elif any(kw in lower for kw in ["balance sheet"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "balance_sheet"
            section_rows = []
            continue
        elif any(kw in lower for kw in ["cash flow"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "cash_flow"
            section_rows = []
            continue

        if current_section and first_cell:
            section_rows.append(row)

    # Flush last section
    if current_section and section_rows:
        _flush_section(current_section, section_rows, df.columns, financials)


def _flush_section(section: str, rows: list, columns, financials: dict):
    """Convert collected rows into financial data for a section."""
    section_df = pd.DataFrame(rows, columns=columns)
    _, parsed = _df_to_financials(section_df, section)
    if parsed:
        financials[section].update(parsed)


def parse_csv(filepath: str) -> dict:
    """Parse a CSV file with financial data.

    Auto-classifies as income_statement, balance_sheet, or cash_flow.
    Returns {income_statement: {...}, balance_sheet: {...}, cash_flow: {...}}.
    """
    df = pd.read_csv(filepath, header=0)

    financials = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
    }

    if df.empty:
        return financials

    stmt_type, parsed = _df_to_financials(df)
    if stmt_type in financials:
        financials[stmt_type] = parsed

    return financials
