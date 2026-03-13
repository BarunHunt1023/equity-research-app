"""Parse CSV and Excel financial data exports (screener.in and generic formats)."""

import logging
import os
import re
import unicodedata
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# screener.in field names → financial_analysis.py compatible names
# Build a case-insensitive lookup by normalizing keys
_FIELD_MAP_RAW = {
    # Income Statement (screener.in → yfinance-style)
    "Sales": "Total Revenue",
    "Revenue": "Total Revenue",
    "Total Revenue": "Total Revenue",
    "Revenue From Operations": "Total Revenue",
    "Revenue from Operations": "Total Revenue",
    "Net Sales": "Total Revenue",
    "Turnover": "Total Revenue",
    "Gross Sales": "Total Revenue",
    "Income From Operations": "Total Revenue",
    "Expenses": "Total Expenses",
    "Total Expenses": "Total Expenses",
    "Cost Of Revenue": "Cost Of Revenue",
    "Cost of Revenue": "Cost Of Revenue",
    "Cost of Goods Sold": "Cost Of Revenue",
    "COGS": "Cost Of Revenue",
    "Raw Material Cost": "Cost Of Revenue",
    "Material Cost": "Cost Of Revenue",
    "Raw Materials Consumed": "Cost Of Revenue",
    "Cost of Materials Consumed": "Cost Of Revenue",
    "Operating Profit": "Operating Income",
    "Operating Income": "Operating Income",
    "EBIT": "Operating Income",
    "EBITDA": "EBITDA",
    "Net Profit": "Net Income",
    "Net Income": "Net Income",
    "Profit After Tax": "Net Income",
    "PAT": "Net Income",
    "Profit for the period": "Net Income",
    "Profit before Tax": "Pretax Income",
    "Profit Before Tax": "Pretax Income",
    "PBT": "Pretax Income",
    "Interest": "Interest Expense",
    "Interest Expense": "Interest Expense",
    "Finance Cost": "Interest Expense",
    "Finance Costs": "Interest Expense",
    "Depreciation": "Depreciation And Amortization",
    "Depreciation And Amortization": "Depreciation And Amortization",
    "Depreciation and Amortization": "Depreciation And Amortization",
    "Depreciation and amortization": "Depreciation And Amortization",
    "Tax": "Tax Provision",
    "Income Tax Expense": "Tax Provision",
    "Tax Provision": "Tax Provision",
    "Tax Expense": "Tax Provision",
    "Other Income": "Other Income",
    "EPS": "Basic EPS",
    "EPS in Rs": "Basic EPS",
    "Basic EPS": "Basic EPS",
    "Gross Profit": "Gross Profit",
    "Dividend Payout": "Dividend Payout",
    "Dividend Amount": "Dividend Payout",

    # Balance Sheet
    "Equity Share Capital": "Common Stock",
    "Share Capital": "Common Stock",
    "Equity Capital": "Common Stock",
    "Common Stock": "Common Stock",
    "Reserves": "Retained Earnings",
    "Reserves and Surplus": "Retained Earnings",
    "Retained Earnings": "Retained Earnings",
    "Borrowings": "Total Debt",
    "Total Debt": "Total Debt",
    "Long Term Debt": "Total Debt",
    "Long Term Borrowings": "Total Debt",
    "Short Term Borrowings": "Short Term Debt",
    "Other Liabilities": "Other Liabilities",
    "Total Liabilities": "Total Liabilities Net Minority Interest",
    "Total": "Total Assets",
    "Total Assets": "Total Assets",
    "Fixed Assets": "Property Plant And Equipment",
    "Net Block": "Property Plant And Equipment",
    "Property Plant And Equipment": "Property Plant And Equipment",
    "Gross Block": "Gross Block",
    "CWIP": "Capital Work In Progress",
    "Capital Work in Progress": "Capital Work In Progress",
    "Capital Work In Progress": "Capital Work In Progress",
    "Investments": "Investments",
    "Other Assets": "Other Assets",
    "Cash and Cash Equivalents": "Cash And Cash Equivalents",
    "Cash & Bank": "Cash And Cash Equivalents",
    "Cash & Short Term Investments": "Cash And Cash Equivalents",
    "Cash Equivalents": "Cash And Cash Equivalents",
    "Current Assets": "Current Assets",
    "Total Current Assets": "Current Assets",
    "Current Liabilities": "Current Liabilities",
    "Total Current Liabilities": "Current Liabilities",
    "Stockholders Equity": "Stockholders Equity",
    "Total Stockholders Equity": "Stockholders Equity",
    "Shareholders Equity": "Stockholders Equity",
    "Inventory": "Inventory",
    "Inventories": "Inventory",
    "Accounts Receivable": "Net Receivables",
    "Trade Receivables": "Net Receivables",
    "Receivables": "Net Receivables",
    "Debtors": "Net Receivables",
    "Accounts Payable": "Accounts Payable",
    "Trade Payables": "Accounts Payable",
    "Creditors": "Accounts Payable",

    # Cash Flow
    "Cash from Operating Activity": "Operating Cash Flow",
    "Cash from Operating Activities": "Operating Cash Flow",
    "Operating Cash Flow": "Operating Cash Flow",
    "Cash from operations": "Operating Cash Flow",
    "Cash from Investing Activity": "Cash From Investing",
    "Cash from Investing Activities": "Cash From Investing",
    "Cash from Financing Activity": "Cash From Financing",
    "Cash from Financing Activities": "Cash From Financing",
    "Net Cash Flow": "Net Cash Flow",
    "Capital Expenditure": "Capital Expenditure",
    "Free Cash Flow": "Free Cash Flow",

    # Additional screener.in variants
    "Profit before tax": "Pretax Income",
    "Profit Before Taxes": "Pretax Income",
    "Income Before Tax": "Pretax Income",
    "Pre-tax Profit": "Pretax Income",
    "Employee Cost": "Employee Cost",
    "Employee Benefit Expense": "Employee Cost",
    "Other Expenses": "Other Expenses",
    "Selling and Admin Expenses": "Other Expenses",
    "Selling and admin": "Other Expenses",
    "Selling and Administration Expenses": "Other Expenses",
    "Total Income": "Total Revenue",
    "Net Revenue": "Total Revenue",
    "Total Revenue from Operations": "Total Revenue",
    "Cost of Materials Consumed": "Cost Of Revenue",
    "Purchase of Stock-in-Trade": "Purchase of Stock-in-Trade",
    "Changes in Inventories": "Changes in Inventories",
    "Change in Inventory": "Changes in Inventories",
    "Change in Inventories": "Changes in Inventories",
    "Manufacturing Expenses": "Manufacturing Expenses",
    "Other Mfr. Exp": "Manufacturing Expenses",
    "Other Manufacturing Expenses": "Manufacturing Expenses",
    "Power and Fuel": "Power and Fuel Cost",
    "Power and Fuel Cost": "Power and Fuel Cost",
    "Rent": "Rent",
    "Exceptional Items": "Exceptional Items",
    "Prior Period Items": "Prior Period Items",
    "Extra-ordinary Items": "Extraordinary Items",
    "Minority Interest": "Minority Interest",
    "Net Block": "Property Plant And Equipment",
    "Tangible Assets": "Property Plant And Equipment",
    "Intangible Assets": "Intangible Assets",
    "Total Non Current Assets": "Total Non Current Assets",
    "Total Non Current Liabilities": "Total Non Current Liabilities",
    "Long Term Provisions": "Long Term Provisions",
    "Short Term Provisions": "Short Term Provisions",
    "Short Term Loans and Advances": "Short Term Loans",
    "Long Term Loans and Advances": "Long Term Loans",
    "Contingent Liabilities": "Contingent Liabilities",
    "Book Value": "Book Value",
    "Face Value": "Face Value",
}

# Build case-insensitive lookup: normalized_key → mapped_value
FIELD_MAP = {}
_FIELD_MAP_LOWER = {}
for k, v in _FIELD_MAP_RAW.items():
    FIELD_MAP[k] = v
    _FIELD_MAP_LOWER[k.lower().strip()] = v

# Keywords for auto-classifying a CSV as IS/BS/CF
IS_KEYWORDS = ["revenue", "sales", "net income", "net profit", "operating profit", "ebitda", "eps", "profit before tax", "operating income"]
BS_KEYWORDS = ["total assets", "borrowings", "equity share", "reserves", "fixed assets", "current assets", "total liabilities", "net block", "share capital"]
CF_KEYWORDS = ["operating activity", "investing activity", "financing activity", "net cash flow", "capital expenditure", "cash from"]

# Pattern to match screener.in date headers like "Mar 2024", "Mar-24", "Mar 24", "Dec 2023"
_DATE_PATTERN = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-/.]?\s*(\d{2,4})$",
    re.IGNORECASE,
)

# Abbreviated month names for quarterly period labels
_MONTH_ABBR = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}

# Pattern for standalone 4-digit year
_YEAR_PATTERN = re.compile(r"^\d{4}$")

# Pattern for Indian financial year format like "2023-24", "FY2024", "FY24"
_FY_PATTERN = re.compile(r"^(?:FY\s*)?(\d{4})\s*[-–]\s*(\d{2,4})$", re.IGNORECASE)
_FY_SHORT_PATTERN = re.compile(r"^FY\s*(\d{2,4})$", re.IGNORECASE)


def _clean_text(s: str) -> str:
    """Strip Unicode whitespace, NBSP, zero-width chars, and normalize."""
    if not s:
        return s
    # Replace various Unicode whitespace with regular space
    s = unicodedata.normalize("NFKC", s)
    # Replace NBSP and other special whitespace
    s = s.replace("\xa0", " ").replace("\u200b", "").replace("\u200c", "").replace("\ufeff", "")
    return s.strip()


def _normalize_period(col) -> str | None:
    """Convert a column header to a clean year string like '2024'.

    Handles: 'Mar 2024', 'Mar-24', Timestamp('2024-03-31'), 2024, 'TTM',
    'FY2024', 'FY24', '2023-24', etc.
    Returns None for non-period columns.
    """
    if col is None:
        return None

    # Handle pandas Timestamp
    if isinstance(col, (pd.Timestamp,)):
        return str(col.year)

    # Handle numeric year
    if isinstance(col, (int, float)):
        try:
            if np.isnan(col):
                return None
        except (TypeError, ValueError):
            pass
        n = int(col)
        if 1900 < n < 2100:
            return str(n)
        return None

    s = _clean_text(str(col))
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

    # Match Indian FY format: "2023-24" → "2024", "FY2024" → "2024"
    m = _FY_PATTERN.match(s)
    if m:
        end_year = m.group(2)
        if len(end_year) == 2:
            year = int(end_year)
            year = year + 2000 if year < 50 else year + 1900
        else:
            year = int(end_year)
        return str(year)

    m = _FY_SHORT_PATTERN.match(s)
    if m:
        year_str = m.group(1)
        if len(year_str) == 2:
            year = int(year_str)
            year = year + 2000 if year < 50 else year + 1900
        else:
            year = int(year_str)
        return str(year)

    # Try parsing as a date string
    try:
        dt = pd.to_datetime(s)
        if dt.year > 1900:
            return str(dt.year)
    except (ValueError, TypeError):
        pass

    return None


def _normalize_quarterly_period(col) -> str | None:
    """Convert a column header to a quarter label like 'Mar-22', 'Jun-23'.

    Unlike _normalize_period which strips to year only, this preserves the
    month+year so quarterly columns retain their quarter granularity.
    Returns None for non-date/non-quarter columns.
    """
    if col is None:
        return None

    # Handle pandas Timestamp
    if isinstance(col, pd.Timestamp):
        return f"{_MONTH_ABBR.get(col.month, 'Jan')}-{str(col.year)[2:]}"

    # Handle numeric year
    if isinstance(col, (int, float)):
        try:
            if np.isnan(col):
                return None
        except (TypeError, ValueError):
            pass
        return None  # bare numbers are years, not quarters

    s = _clean_text(str(col))
    if not s or s.lower() == "nan":
        return None

    # Skip TTM
    if s.upper() in ("TTM", "LTM"):
        return None

    # Match "Mar 2024", "Mar-24", "Mar 22" etc.
    m = _DATE_PATTERN.match(s)
    if m:
        month_str = m.group(1).capitalize()[:3]
        year_str = m.group(2)
        if len(year_str) == 2:
            short_year = year_str
        else:
            short_year = year_str[-2:]
        return f"{month_str}-{short_year}"

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
    # Need at least 2 date values and they should be majority
    return date_count >= 2 and date_count >= total * 0.5


def _find_header_row(df_raw: pd.DataFrame) -> int:
    """Find the row index that contains date headers in a screener.in sheet.

    Returns the row index (0-based), or -1 if no date header row found.
    """
    # Check first 10 rows for date-like content.
    # Named sheets (Profit & Loss, Balance Sheet, Cash Flow) have dates in row 0 or 1.
    # The Data Sheet uses multi-section detection instead (see _parse_data_sheet_from_file).
    for i in range(min(10, len(df_raw))):
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
    s = _clean_text(str(val))
    if not s or s in ("-", "—", "–", "N/A", "n/a", ""):
        return None
    # Remove percentage sign (OPM%, Tax%, etc. are not useful as raw values)
    if s.endswith("%"):
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    s = s.replace(",", "").replace("$", "").replace("₹", "").replace("Rs", "").replace("Rs.", "").strip()
    try:
        num = float(s)
        return -num if negative else num
    except ValueError:
        return None


def _map_field(name: str) -> str:
    """Map a field name to its standardized equivalent.

    Handles Unicode whitespace, case-insensitive matching, and common
    formatting variations from screener.in exports.
    """
    cleaned = _clean_text(name)
    if not cleaned:
        return name.strip()

    # Remove leading/trailing special characters that screener.in might add
    cleaned = cleaned.strip("+-*#·•→← \t")

    # Exact match first
    if cleaned in FIELD_MAP:
        return FIELD_MAP[cleaned]

    # Case-insensitive match
    lower = cleaned.lower()
    if lower in _FIELD_MAP_LOWER:
        return _FIELD_MAP_LOWER[lower]

    # Try without trailing numbers/spaces (e.g., "Sales  " or "Depreciation 1")
    simplified = re.sub(r"\s+\d+$", "", cleaned).strip()
    if simplified in FIELD_MAP:
        return FIELD_MAP[simplified]
    if simplified.lower() in _FIELD_MAP_LOWER:
        return _FIELD_MAP_LOWER[simplified.lower()]

    return cleaned


def _is_entity_name(s: str) -> bool:
    """Check if a string looks like a company/entity name rather than a period."""
    if not s:
        return False
    lower = s.lower().strip()
    # Skip common column headers that are NOT entity names
    non_entity_labels = {
        "narration", "particulars", "report date", "date", "year", "period",
        "trailing", "best case", "worst case", "description", "item", "items",
    }
    if lower in non_entity_labels:
        return False
    # Contains "Ltd", "Inc", "Corp", "Limited" etc.
    entity_markers = ["ltd", "limited", "inc", "corp", "llc", "llp", "pvt", "private", "public"]
    if any(marker in lower for marker in entity_markers):
        return True
    # All alphabetic with spaces (no digits) and longer than 5 chars
    if len(s) > 5 and not any(c.isdigit() for c in s) and any(c.isalpha() for c in s):
        # Probably a name, not a period
        return True
    return False


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
    # Columns that should be skipped entirely (not financial periods)
    _SKIP_COLUMNS = {"narration", "particulars", "report date", "date", "year",
                     "period", "description", "item", "items"}
    entity_name = None
    for col in df.columns:
        # Normalize column to a clean period string
        period = _normalize_period(col)
        if period is None:
            raw = _clean_text(str(col))
            if not raw or raw.startswith("Unnamed") or raw.lower() == "nan":
                continue
            # Skip percentage columns
            if "%" in raw:
                continue
            # Skip known non-period label columns
            if raw.lower() in _SKIP_COLUMNS:
                continue
            # Skip entity/company name columns
            if _is_entity_name(raw):
                entity_name = raw
                logger.info("Skipping entity name column: %s", raw)
                # Still parse the data but use "Latest" as the period
                period = "Latest"
            else:
                period = raw
        elif period == "TTM":
            continue  # Skip TTM column

        # Skip percentage columns
        if "%" in str(col):
            continue

        period_data = {}
        for idx in df.index:
            label = _clean_text(str(idx))
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
    "income_statement": ["profit & loss", "profit and loss", "income statement", "income", "p&l", "pl", "p & l"],
    "balance_sheet": ["balance sheet", "bs"],
    "cash_flow": ["cash flow", "cash flows", "cf", "cashflow"],
    "quarterly_results": ["quarterly results", "quarterly", "quarters", "quarter"],
}


def _match_sheet_type(sheet_name: str) -> str | None:
    """Match a sheet name to a financial statement type."""
    lower = sheet_name.lower().strip()
    for stmt_type, patterns in SHEET_PATTERNS.items():
        for pattern in patterns:
            if pattern in lower:
                return stmt_type
    return None


def _df_to_quarterly(df: pd.DataFrame) -> dict:
    """Convert a DataFrame with quarterly columns to {quarter_label: {field: value}}.

    Similar to _df_to_financials but uses _normalize_quarterly_period to
    preserve the month-year granularity (e.g. 'Mar-22', 'Jun-22').
    Skips percentage/ratio rows (values that are strings ending in %).
    """
    if df is None or df.empty:
        return {}

    df = df.copy()

    # Use first column as row index if it's string-like
    first_col = df.iloc[:, 0]
    if first_col.dtype == object:
        df = df.set_index(df.columns[0])

    result = {}
    _SKIP_COLUMNS = {"narration", "particulars", "report date", "date", "year",
                     "period", "description", "item", "items", "ttm", "ltm"}

    for col in df.columns:
        quarter_label = _normalize_quarterly_period(col)
        if quarter_label is None:
            raw = _clean_text(str(col))
            if not raw or raw.startswith("Unnamed") or raw.lower() in _SKIP_COLUMNS:
                continue
            if "%" in raw:
                continue
            # Skip entity/company name columns
            if _is_entity_name(raw):
                continue
            quarter_label = raw

        period_data = {}
        for idx in df.index:
            label = _clean_text(str(idx))
            if not label or label.lower() in ("", "nan"):
                continue
            # Skip percentage/derived rows — we'll compute them ourselves
            if any(k in label.lower() for k in [
                "margin", "growth", "yoy", "opm", "pbt margin", "net profit margin",
                "actual tax", "coverage", "ratio", "turnover", "days", "yield",
            ]):
                continue
            mapped = _map_field(label)
            val = _parse_number(df.at[idx, col])
            if val is not None:
                period_data[mapped] = val

        if period_data:
            result[quarter_label] = period_data

    return result


def _parse_quarterly_sheet(filepath: str, sheet_name: str) -> dict:
    """Parse a quarterly results sheet from a screener.in Excel file.

    Returns {quarter_label: {field_name: value}}.
    """
    try:
        df = _read_sheet_with_header_detection(filepath, sheet_name)
        if df is None or df.empty:
            return {}
        result = _df_to_quarterly(df)
        logger.info("Parsed quarterly sheet '%s': %d quarters", sheet_name, len(result))
        return result
    except Exception as e:
        logger.warning("Failed to parse quarterly sheet '%s': %s", sheet_name, e)
        return {}


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

    logger.info("Sheet '%s': raw shape %s, first rows:", sheet_name, df_raw.shape)
    for i in range(min(3, len(df_raw))):
        logger.info("  Row %d: %s", i, list(df_raw.iloc[i]))

    # Check if row 0 columns already look like dates (normal format)
    row0_values = df_raw.iloc[0, 1:] if len(df_raw.columns) > 1 else df_raw.iloc[0]
    if _is_date_row(row0_values):
        logger.info("Sheet '%s': row 0 has dates, using header=0", sheet_name)
        df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
        return df

    # Look for the actual header row in subsequent rows
    header_row = _find_header_row(df_raw)
    if header_row >= 0:
        logger.info("Sheet '%s': found date header at row %d", sheet_name, header_row)
        df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)
        return df

    # Fallback: check if column names from header=0 look like dates
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
    col_dates = sum(1 for c in df.columns[1:] if _normalize_period(c) is not None)
    if col_dates >= 2:
        logger.info("Sheet '%s': header=0 columns have %d dates", sheet_name, col_dates)
        return df

    # Try: maybe the data is transposed or has an unusual layout
    # Check all columns in header=0 for any date-like values
    logger.info("Sheet '%s': no date headers found, using header=0 fallback. Columns: %s",
                sheet_name, list(df.columns))
    return df


def _has_sufficient_data(financials: dict) -> bool:
    """Check if parsed financials have meaningful data across statement types."""
    has_is = bool(financials.get("income_statement"))
    has_bs = bool(financials.get("balance_sheet"))
    # Need at least income_statement data for the app to be useful
    if not has_is:
        return False
    # Check that income_statement has real numeric values (not just empty periods)
    for period_data in financials["income_statement"].values():
        if any(k in period_data for k in ("Total Revenue", "Net Income", "Operating Income")):
            return True
    return False


def _count_fields(financials: dict) -> int:
    """Count total unique fields across all statement types and periods."""
    count = 0
    for key, stmt_data in financials.items():
        if key == "metadata":
            continue
        for period_data in stmt_data.values():
            if isinstance(period_data, dict):
                count += len(period_data)
    return count


def parse_excel(filepath: str) -> dict:
    """Parse an Excel file with financial data (screener.in or generic format).

    Returns {income_statement: {...}, balance_sheet: {...}, cash_flow: {...}}.

    Strategy for screener.in files:
    - The "Data Sheet" contains raw financial data (actual numbers)
    - "Profit & Loss", "Balance Sheet", "Cash Flow" sheets often contain FORMULAS
      referencing the Data Sheet. If the file was generated server-side without
      formula evaluation, these cells may read as None.
    - We parse the Data Sheet FIRST (primary source), then supplement with
      data from named sheets if they have cached formula values.
    """
    # Get sheet names first
    xl = pd.ExcelFile(filepath)
    sheet_names = xl.sheet_names
    logger.info("Excel sheets: %s", sheet_names)

    financials = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
        "quarterly_results": {},
        "metadata": {},
    }

    # Step 1: Parse "Data Sheet" first if present (screener.in primary data source)
    data_sheet_name = None
    for sn in sheet_names:
        if sn.lower().strip() in ("data sheet", "data"):
            data_sheet_name = sn
            break

    if data_sheet_name:
        logger.info("Parsing Data Sheet '%s' first (primary data source)", data_sheet_name)
        _parse_data_sheet_from_file(filepath, financials, sheet_name=data_sheet_name)
        # Extract company metadata from the Data Sheet META section
        meta = _extract_company_metadata(filepath, sheet_name=data_sheet_name)
        if meta:
            financials["metadata"].update(meta)
            logger.info("Extracted metadata: %s", meta)
        logger.info("After Data Sheet: IS=%d periods, BS=%d periods, CF=%d periods",
                     len(financials["income_statement"]),
                     len(financials["balance_sheet"]),
                     len(financials["cash_flow"]))

    # Step 2: Parse named sheets (Profit & Loss, Balance Sheet, Cash Flow, Quarterly)
    named_financials = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
    }

    for sheet_name in sheet_names:
        lower_name = sheet_name.lower().strip()
        # Skip non-financial sheets
        if lower_name in ("data sheet", "customization", "data"):
            continue

        # Handle quarterly sheets separately
        if any(kw in lower_name for kw in ["quarterly results", "quarterly", "quarters", "quarter"]):
            if not financials["quarterly_results"]:
                quarterly_parsed = _parse_quarterly_sheet(filepath, sheet_name)
                if quarterly_parsed:
                    financials["quarterly_results"] = quarterly_parsed
                    logger.info("Quarterly results from sheet '%s': %d quarters", sheet_name, len(quarterly_parsed))
            continue

        df = _read_sheet_with_header_detection(filepath, sheet_name)
        if df is None or df.empty:
            continue

        # Try to match by sheet name first
        stmt_type = _match_sheet_type(sheet_name)

        # Parse the sheet
        classified_type, parsed = _df_to_financials(df, stmt_type)

        logger.info("Sheet '%s' → type=%s, periods=%s", sheet_name, classified_type,
                     list(parsed.keys()) if parsed else "empty")
        if parsed:
            first_period = next(iter(parsed))
            logger.info("  Fields in '%s': %s", first_period, list(parsed[first_period].keys()))

        if classified_type in financials and parsed:
            named_financials[classified_type].update(parsed)

    # Step 3: Merge - use named sheet data to supplement Data Sheet data
    # Named sheets may have additional computed fields or better organization
    for stmt_type in ("income_statement", "balance_sheet", "cash_flow"):
        ds_data = financials[stmt_type]
        ns_data = named_financials[stmt_type]

        if not ds_data and ns_data:
            # Data Sheet had nothing for this type, use named sheet data
            financials[stmt_type] = ns_data
        elif ds_data and ns_data:
            # Both have data - merge, preferring Data Sheet for existing fields
            # but adding any extra fields from named sheets
            for period, items in ns_data.items():
                if period not in ds_data:
                    ds_data[period] = items
                else:
                    for field, value in items.items():
                        if field not in ds_data[period]:
                            ds_data[period][field] = value

    # Step 4: If still no good data, try parsing ALL sheets as generic financials
    if not _has_sufficient_data(financials):
        logger.info("Insufficient data after standard parsing, trying all sheets as generic")
        for sheet_name in sheet_names:
            lower_name = sheet_name.lower().strip()
            if lower_name in ("customization", "quarters"):
                continue
            # Skip sheets we already tried
            if _match_sheet_type(sheet_name) is not None:
                continue
            if lower_name in ("data sheet", "data"):
                continue

            df = _read_sheet_with_header_detection(filepath, sheet_name)
            if df is None or df.empty:
                continue

            classified_type, parsed = _df_to_financials(df)
            logger.info("Generic parse '%s' → type=%s, periods=%s", sheet_name,
                         classified_type, list(parsed.keys()) if parsed else "empty")
            if classified_type in financials and parsed:
                for period, items in parsed.items():
                    if period not in financials[classified_type]:
                        financials[classified_type][period] = items
                    else:
                        financials[classified_type][period].update(items)

    # Post-process: compute derived fields if missing
    _compute_derived_fields(financials)

    # Log final structure (skip metadata which has a different structure)
    for stmt, data in financials.items():
        if stmt == "metadata":
            logger.info("Final metadata: %s", data)
            continue
        if data:
            logger.info("Final %s: periods=%s", stmt, list(data.keys()))
            for period, items in data.items():
                logger.info("  %s: %s", period, list(items.keys())[:10])
        else:
            logger.info("Final %s: EMPTY", stmt)

    return financials


def _extract_company_metadata(filepath: str, sheet_name: str = "Data Sheet") -> dict:
    """Extract company metadata from a screener.in Excel export.

    Tries multiple sources in order of reliability:
    1. Data Sheet META section (rows 0-20): label-value pairs for
       COMPANY NAME, Number of shares, Face Value, Current Price, Market Cap.
       Note: these are formula-driven cells and may be empty if formulas
       weren't evaluated — in that case we fall through.
    2. Named sheets (Profit & Loss, Balance Sheet, etc.) row 0: screener.in
       puts the company name in the first cell of the header row (row 0).
    3. Customization sheet: may have company name in a cell.
    """
    xl = pd.ExcelFile(filepath)
    sheet_names = xl.sheet_names
    metadata = {}

    label_map = {
        "company name": "company_name",
        "number of shares": "shares_outstanding",
        "face value": "face_value",
        "current price": "current_price",
        "market capitalization": "market_cap",
    }

    # Source 1: Data Sheet META section (label in col A, value in col B)
    if sheet_name in sheet_names:
        try:
            df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
            for i in range(min(20, len(df_raw))):
                cell_a = _clean_text(str(df_raw.iloc[i, 0])).lower() if pd.notna(df_raw.iloc[i, 0]) else ""
                if not cell_a:
                    continue
                for label, key in label_map.items():
                    if label in cell_a and key not in metadata:
                        for col in range(1, min(6, len(df_raw.columns))):
                            cell_val = df_raw.iloc[i, col]
                            if cell_val is not None and pd.notna(cell_val) and str(cell_val).strip():
                                metadata[key] = cell_val
                                break
                        break
        except Exception:
            pass

    # Source 2: Named financial sheets — company name in row 0, col 0
    if "company_name" not in metadata:
        for sn in sheet_names:
            lower = sn.lower().strip()
            if lower in ("data sheet", "data", "customization", "quarters"):
                continue
            if any(kw in lower for kw in ["profit", "balance", "cash", "p&l", "income"]):
                try:
                    df_raw = pd.read_excel(filepath, sheet_name=sn, header=None)
                    if df_raw.empty:
                        continue
                    cell = _clean_text(str(df_raw.iloc[0, 0])) if pd.notna(df_raw.iloc[0, 0]) else ""
                    # A valid company name: non-empty, not a date, not a generic label
                    if (cell and len(cell) > 3
                            and _normalize_period(cell) is None
                            and cell.lower() not in ("narration", "particulars", "report date")):
                        metadata["company_name"] = cell
                        logger.info("Extracted company name from sheet '%s' row 0: %s", sn, cell)
                        break
                except Exception:
                    continue

    # Source 3: Customization sheet — may have company name as label-value
    if "company_name" not in metadata:
        for sn in sheet_names:
            if sn.lower().strip() == "customization":
                try:
                    df_raw = pd.read_excel(filepath, sheet_name=sn, header=None)
                    for i in range(min(15, len(df_raw))):
                        cell_a = _clean_text(str(df_raw.iloc[i, 0])).lower() if pd.notna(df_raw.iloc[i, 0]) else ""
                        if "company" in cell_a or "name" in cell_a:
                            for col in range(1, min(4, len(df_raw.columns))):
                                cell_val = df_raw.iloc[i, col]
                                if cell_val is not None and pd.notna(cell_val) and str(cell_val).strip():
                                    metadata["company_name"] = str(cell_val).strip()
                                    break
                            if "company_name" in metadata:
                                break
                except Exception:
                    pass

    return metadata


def _parse_data_sheet_from_file(filepath: str, financials: dict, sheet_name: str = "Data Sheet"):
    """Parse screener.in's combined 'Data Sheet' with proper header detection.

    The Data Sheet in screener.in exports contains raw financial data organized
    in sections: Profit & Loss, Balance Sheet, Cash Flow. Each section has its
    own 'Report Date' header row with date columns and line items with actual
    numeric values (not formulas).

    For multi-section Data Sheets, we read with header=None and let
    _parse_data_sheet + _flush_section handle per-section date headers.
    Using a global header row would eat the first section marker.
    """
    try:
        df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    except Exception as e:
        logger.warning("Failed to read sheet '%s': %s", sheet_name, e)
        return

    if df_raw.empty:
        return

    logger.info("Data Sheet '%s': raw shape %s", sheet_name, df_raw.shape)
    for i in range(min(5, len(df_raw))):
        logger.info("  Row %d: %s", i, list(df_raw.iloc[i])[:8])

    # Check if this is a multi-section Data Sheet (screener.in format)
    # by scanning for section markers like "Profit & Loss", "Balance Sheet", etc.
    has_sections = False
    section_keywords = ["profit & loss", "profit and loss", "income statement",
                        "balance sheet", "cash flow", "cashflow"]
    for i in range(min(30, len(df_raw))):
        cell = str(df_raw.iloc[i, 0]).lower().strip() if pd.notna(df_raw.iloc[i, 0]) else ""
        if any(kw in cell for kw in section_keywords):
            has_sections = True
            logger.info("Data Sheet: detected multi-section format (found '%s' at row %d)",
                        df_raw.iloc[i, 0], i)
            break

    if has_sections:
        # Multi-section format: read without header row.
        # Each section has its own "Report Date" row which _flush_section
        # will detect and use as column headers for that section's data.
        df_raw.columns = range(len(df_raw.columns))
        _parse_data_sheet(df_raw, financials)
    else:
        # Single-section or no sections: use header detection
        header_row = _find_header_row(df_raw)
        if header_row >= 0:
            logger.info("Data Sheet: found date header at row %d", header_row)
            df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)
        else:
            # Fallback: check if row 0 has dates when read with header=0
            df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
            col_dates = sum(1 for c in df.columns[1:] if _normalize_period(c) is not None)
            if col_dates < 2:
                # Try header=1 in case row 0 is a title
                df2 = pd.read_excel(filepath, sheet_name=sheet_name, header=1)
                col_dates2 = sum(1 for c in df2.columns[1:] if _normalize_period(c) is not None)
                if col_dates2 > col_dates:
                    logger.info("Data Sheet: header=1 has more dates (%d vs %d)", col_dates2, col_dates)
                    df = df2

        _parse_data_sheet(df, financials)


def _parse_data_sheet(df: pd.DataFrame, financials: dict):
    """Parse screener.in's combined 'Data Sheet' which has all statements in sections.

    The Data Sheet typically has section headers like "Profit & Loss", "Balance Sheet",
    "Cash Flow" followed by line items. We detect these sections and parse each one
    into the appropriate statement type.

    If no section headers are found, we try to parse the entire sheet and auto-classify.
    """
    if df.empty:
        return

    current_section = None
    section_rows = []
    found_sections = False

    for _, row in df.iterrows():
        first_cell = _clean_text(str(row.iloc[0])) if pd.notna(row.iloc[0]) else ""
        lower = first_cell.lower()

        # Detect section headers
        if any(kw in lower for kw in ["profit & loss", "profit and loss", "income statement", "p&l"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "income_statement"
            section_rows = []
            found_sections = True
            continue
        elif any(kw in lower for kw in ["balance sheet"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "balance_sheet"
            section_rows = []
            found_sections = True
            continue
        elif any(kw in lower for kw in ["cash flow", "cashflow"]):
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "cash_flow"
            section_rows = []
            found_sections = True
            continue
        elif any(lower.startswith(kw) for kw in ["quarter"]):
            # Capture quarterly section data
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = "quarterly_results"
            section_rows = []
            found_sections = True
            continue
        elif any(lower.startswith(kw) for kw in ["price", "derived"]):
            # Skip price/derived sections
            if current_section and section_rows:
                _flush_section(current_section, section_rows, df.columns, financials)
            current_section = None
            section_rows = []
            found_sections = True
            continue

        if current_section and first_cell:
            section_rows.append(row)

    # Flush last section
    if current_section and section_rows:
        _flush_section(current_section, section_rows, df.columns, financials)

    # If no section headers were found, try auto-classifying the entire sheet
    if not found_sections:
        logger.info("Data Sheet: no section headers found, auto-classifying entire sheet")
        # Try to split the data by content classification
        is_rows = []
        bs_rows = []
        cf_rows = []

        for _, row in df.iterrows():
            first_cell = _clean_text(str(row.iloc[0])) if pd.notna(row.iloc[0]) else ""
            if not first_cell or first_cell.lower() in ("", "nan"):
                continue
            lower = first_cell.lower()
            mapped = _map_field(first_cell)

            # Classify each row individually based on its field name
            if any(kw in lower for kw in ["revenue", "sales", "operating profit",
                                           "net profit", "ebitda", "ebit", "eps",
                                           "profit before tax", "profit after tax",
                                           "interest", "depreciation", "expenses",
                                           "other income", "tax", "pat", "pbt",
                                           "dividend", "gross profit", "operating income"]):
                is_rows.append(row)
            elif any(kw in lower for kw in ["assets", "liabilities", "equity",
                                             "borrowings", "reserves", "capital",
                                             "share capital", "debt", "investments",
                                             "receivables", "payables", "inventory",
                                             "cash & bank", "net block", "fixed assets",
                                             "cwip", "debtors", "creditors"]):
                bs_rows.append(row)
            elif any(kw in lower for kw in ["operating activity", "investing activity",
                                             "financing activity", "cash from",
                                             "net cash flow", "free cash flow",
                                             "capital expenditure", "capex"]):
                cf_rows.append(row)
            else:
                # Unmapped - try to put it in the most likely bucket
                if any(kw in mapped.lower() for kw in ["revenue", "income", "expense", "profit", "eps"]):
                    is_rows.append(row)
                elif any(kw in mapped.lower() for kw in ["asset", "debt", "equity", "liability"]):
                    bs_rows.append(row)

        if is_rows:
            _flush_section("income_statement", is_rows, df.columns, financials)
        if bs_rows:
            _flush_section("balance_sheet", bs_rows, df.columns, financials)
        if cf_rows:
            _flush_section("cash_flow", cf_rows, df.columns, financials)


def _flush_section(section: str, rows: list, columns, financials: dict):
    """Convert collected rows into financial data for a section.

    Handles screener.in Data Sheet format where each section has its own
    'Report Date' header row with date columns (e.g., Dec-16, Dec-17, ...).
    When the overall sheet header detection fails (dates are past row 10),
    the DataFrame columns are wrong. This function detects per-section
    date header rows and uses them as proper column headers.
    """
    if not rows:
        return

    section_df = pd.DataFrame(rows, columns=columns)

    # Check if the first row is a date header row (e.g., "Report Date | Dec-16 | Dec-17 | ...")
    # This happens in screener.in Data Sheet where the overall header detection fails
    # because the META section pushes date headers past the search range.
    if len(section_df) > 1:
        first_row = section_df.iloc[0]
        first_cell = _clean_text(str(first_row.iloc[0])) if pd.notna(first_row.iloc[0]) else ""
        row_values = first_row.iloc[1:] if len(first_row) > 1 else first_row

        if first_cell.lower() in ("report date", "date", "year", "period", "particulars") or _is_date_row(row_values):
            # Use this row as column headers for the remaining data rows
            new_headers = list(first_row.values)
            data_rows = section_df.iloc[1:]
            if data_rows.empty:
                return
            section_df = pd.DataFrame(data_rows.values, columns=new_headers)

    if section == "quarterly_results":
        parsed = _df_to_quarterly(section_df)
        if parsed:
            financials["quarterly_results"].update(parsed)
    else:
        _, parsed = _df_to_financials(section_df, section)
        if parsed:
            financials[section].update(parsed)


def _compute_derived_fields(financials: dict):
    """Compute derived financial fields that screener.in doesn't provide directly."""
    bs = financials.get("balance_sheet", {})
    is_data = financials.get("income_statement", {})

    for period, data in bs.items():
        # Compute Stockholders Equity if not present
        if "Stockholders Equity" not in data:
            common = data.get("Common Stock")
            retained = data.get("Retained Earnings")
            if common is not None and retained is not None:
                data["Stockholders Equity"] = common + retained

        # Compute Total Liabilities if not present
        if "Total Liabilities Net Minority Interest" not in data:
            total_assets = data.get("Total Assets")
            equity = data.get("Stockholders Equity")
            if total_assets is not None and equity is not None:
                data["Total Liabilities Net Minority Interest"] = total_assets - equity

    for period, data in is_data.items():
        # Compute Gross Profit if we have Revenue and COGS
        if "Gross Profit" not in data:
            revenue = data.get("Total Revenue")
            cogs = data.get("Cost Of Revenue")
            if revenue is not None and cogs is not None:
                data["Gross Profit"] = revenue - abs(cogs)

        # Compute Operating Income from PBT + Interest if missing
        # (must be BEFORE EBITDA so EBITDA can use the derived Operating Income)
        if "Operating Income" not in data:
            pbt = data.get("Pretax Income")
            interest = data.get("Interest Expense")
            other_income = data.get("Other Income", 0)
            if pbt is not None and interest is not None:
                data["Operating Income"] = pbt + abs(interest) - abs(other_income)

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
