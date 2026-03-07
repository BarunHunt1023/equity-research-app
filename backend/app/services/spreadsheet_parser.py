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
    "Raw Material Cost": "Cost Of Revenue",
    "Material Cost": "Cost Of Revenue",

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
    "Net Block": "Property Plant And Equipment",
    "Property Plant And Equipment": "Property Plant And Equipment",
    "CWIP": "Capital Work In Progress",
    "Capital Work in Progress": "Capital Work In Progress",
    "Investments": "Investments",
    "Other Assets": "Other Assets",
    "Cash and Cash Equivalents": "Cash And Cash Equivalents",
    "Cash & Bank": "Cash And Cash Equivalents",
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
    "Receivables": "Net Receivables",

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

# Pattern to match screener.in date headers like "Mar 2024", "Mar-24", "Mar 24", "Dec 2023"
_DATE_PATTERN = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-/]?\s*(\d{2,4})$",
    re.IGNORECASE,
)

# Pattern for standalone 4-digit year
_YEAR_PATTERN = re.compile(r"^\d{4}$")


def _normalize_period(col) -> str | None:
    """Convert a column header to a clean year string like '2024'.

    Handles: 'Mar 2024', 'Mar-24', Timestamp('2024-03-31'), 2024, 'TTM', etc.
    Returns None for non-period columns.
    """
    if col is None:
        return None

    # Handle pandas Timestamp
    if isinstance(col, (pd.Timestamp,)):
        return str(col.year)

    # Handle numeric year
    if isinstance(col, (int, float)) and not np.isnan(col):
        n = int(col)
        if 1900 < n < 2100:
            return str(n)
        return None

    s = str(col).strip()
    if not s or s.lower() == "nan":
        return None

    # Skip TTM column
    if s.upper() == "TTM":
        return "TTM"

    # Match "Mar 2024", "Mar-24" etc.
    m = _DATE_PATTERN.match(s)
    if m:
        year_str = m.group(2)
        if len(year_str) == 2:
            year = int(year_str)
            year = year + 2000 if year < 50 else year + 1900
        else:
            year = int(year_str)
        return str(year)

    # Match standalone year "2024"
    if _YEAR_PATTERN.match(s):
        return s

    # Try parsing as a date string
    try:
        dt = pd.to_datetime(s)
        if dt.year > 1900:
            return str(dt.year)
    except (ValueError, TypeError):
        pass

    return None


def _is_date_row(row_values) -> bool:
    """Check if a row contains mostly date-like values (potential header row)."""
    date_count = 0
    total = 0
    for val in row_values:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            continue
        s = str(val).strip()
        if not s:
            continue
        total += 1
        if _normalize_period(val) is not None:
            date_count += 1
    return date_count >= 2 and date_count >= total * 0.5


def _find_header_row(df_raw: pd.DataFrame) -> int:
    """Find the row index that contains date headers in a screener.in sheet.

    Returns the row index (0-based), or -1 if no date header row found.
    """
    # Check first 5 rows for date-like content
    for i in range(min(5, len(df_raw))):
        row = df_raw.iloc[i]
        # Skip first cell (might be label like "Report Date" or empty)
        values = row.iloc[1:] if len(row) > 1 else row
        if _is_date_row(values):
            return i
    return -1


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

    df = df.copy()

    # If first column looks like labels (mostly strings), use it as index
    first_col = df.iloc[:, 0]
    if first_col.dtype == object:
        df = df.set_index(df.columns[0])

    # Auto-classify if not specified
    if not statement_type:
        line_items = [str(idx) for idx in df.index]
        statement_type = _classify_content(line_items)

    # Build {period: {mapped_line_item: value}} dict
    result = {}
    for col in df.columns:
        # Normalize column to a clean period string
        period = _normalize_period(col)
        if period is None:
            # Fallback: use raw string but skip "Unnamed:" columns
            raw = str(col).strip()
            if raw.startswith("Unnamed") or raw.lower() == "nan" or not raw:
                continue
            # Skip percentage columns
            if "%" in raw:
                continue
            period = raw
        elif period == "TTM":
            continue  # Skip TTM column

        # Skip percentage columns
        if "%" in str(col):
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


def _read_sheet_with_header_detection(filepath: str, sheet_name: str) -> pd.DataFrame:
    """Read an Excel sheet, detecting the correct header row for screener.in format.

    Screener.in exports often have the company name in row 0 and actual date
    headers in row 1 or later. This function finds the date header row and
    uses it properly.
    """
    # First read without headers to inspect raw data
    df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    if df_raw.empty:
        return df_raw

    # Check if row 0 columns already look like dates (normal format)
    row0_values = df_raw.iloc[0, 1:] if len(df_raw.columns) > 1 else df_raw.iloc[0]
    if _is_date_row(row0_values):
        # Row 0 is the header - read normally
        df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
        return df

    # Look for the actual header row in subsequent rows
    header_row = _find_header_row(df_raw)
    if header_row >= 0:
        # Re-read with correct header row
        df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)
        return df

    # Fallback: check if column names from header=0 look like dates
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
    col_dates = sum(1 for c in df.columns[1:] if _normalize_period(c) is not None)
    if col_dates >= 2:
        return df

    # Last resort: just use header=0
    return df


def parse_excel(filepath: str) -> dict:
    """Parse an Excel file with financial data (screener.in or generic format).

    Returns {income_statement: {...}, balance_sheet: {...}, cash_flow: {...}}.
    """
    # Get sheet names first
    xl = pd.ExcelFile(filepath)
    sheet_names = xl.sheet_names

    financials = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
    }

    for sheet_name in sheet_names:
        # Skip metadata/customization sheets
        lower_name = sheet_name.lower().strip()
        if lower_name in ("data sheet", "customization", "quarters", "data"):
            continue

        df = _read_sheet_with_header_detection(filepath, sheet_name)
        if df is None or df.empty:
            continue

        # Try to match by sheet name first
        stmt_type = _match_sheet_type(sheet_name)

        # Parse the sheet
        classified_type, parsed = _df_to_financials(df, stmt_type)

        if classified_type in financials and parsed:
            financials[classified_type].update(parsed)

    # If only "Data Sheet" exists (some screener.in exports), try to parse it
    if all(not v for v in financials.values()) and "Data Sheet" in sheet_names:
        _parse_data_sheet_from_file(filepath, financials)

    # Post-process: compute derived fields if missing
    _compute_derived_fields(financials)

    return financials


def _parse_data_sheet_from_file(filepath: str, financials: dict):
    """Parse screener.in's combined 'Data Sheet' with proper header detection."""
    df_raw = pd.read_excel(filepath, sheet_name="Data Sheet", header=None)
    if df_raw.empty:
        return

    # Find the date header row
    header_row = _find_header_row(df_raw)
    if header_row >= 0:
        # Build period labels from the header row
        period_labels = []
        for val in df_raw.iloc[header_row]:
            period_labels.append(_normalize_period(val))

        # Read data starting after the header row
        df = pd.read_excel(filepath, sheet_name="Data Sheet", header=header_row)
    else:
        # Fallback: read with header=0
        df = pd.read_excel(filepath, sheet_name="Data Sheet", header=0)

    _parse_data_sheet(df, financials)


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


def _compute_derived_fields(financials: dict):
    """Compute derived financial fields that screener.in doesn't provide directly.

    For example: Stockholders Equity = Common Stock + Retained Earnings,
    Total Assets from components, etc.
    """
    bs = financials.get("balance_sheet", {})
    is_data = financials.get("income_statement", {})

    for period, data in bs.items():
        # Compute Stockholders Equity if not present
        if "Stockholders Equity" not in data:
            common = data.get("Common Stock")
            retained = data.get("Retained Earnings")
            if common is not None and retained is not None:
                data["Stockholders Equity"] = common + retained

    for period, data in is_data.items():
        # Compute Gross Profit if we have Revenue and COGS
        if "Gross Profit" not in data:
            revenue = data.get("Total Revenue")
            cogs = data.get("Cost Of Revenue")
            if revenue is not None and cogs is not None:
                data["Gross Profit"] = revenue - abs(cogs)

        # Compute EBITDA if we have Operating Income and D&A
        if "EBITDA" not in data:
            op_income = data.get("Operating Income")
            da = data.get("Depreciation And Amortization")
            if op_income is not None and da is not None:
                data["EBITDA"] = op_income + abs(da)


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
