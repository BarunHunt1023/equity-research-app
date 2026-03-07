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
    # Check first 10 rows for date-like content (increased from 5)
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
    # Contains "Ltd", "Inc", "Corp", "Limited" etc.
    lower = s.lower()
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


def parse_excel(filepath: str) -> dict:
    """Parse an Excel file with financial data (screener.in or generic format).

    Returns {income_statement: {...}, balance_sheet: {...}, cash_flow: {...}}.
    """
    # Get sheet names first
    xl = pd.ExcelFile(filepath)
    sheet_names = xl.sheet_names
    logger.info("Excel sheets: %s", sheet_names)

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

        logger.info("Sheet '%s' → type=%s, periods=%s", sheet_name, classified_type,
                     list(parsed.keys()) if parsed else "empty")
        if parsed:
            # Log field names for first period to help debug mapping issues
            first_period = next(iter(parsed))
            logger.info("  Fields in '%s': %s", first_period, list(parsed[first_period].keys()))

        if classified_type in financials and parsed:
            financials[classified_type].update(parsed)

    # If only "Data Sheet" exists (some screener.in exports), try to parse it
    if all(not v for v in financials.values()) and "Data Sheet" in sheet_names:
        logger.info("Falling back to Data Sheet parsing")
        _parse_data_sheet_from_file(filepath, financials)

    # Also try Data Sheet if we got very little data (e.g., only entity name periods)
    if "Data Sheet" in sheet_names:
        has_real_periods = False
        for stmt_data in financials.values():
            for period_key in stmt_data:
                if _normalize_period(period_key) is not None and period_key != "Latest":
                    has_real_periods = True
                    break
        if not has_real_periods:
            logger.info("No real date periods found, trying Data Sheet")
            _parse_data_sheet_from_file(filepath, financials)

    # Post-process: compute derived fields if missing
    _compute_derived_fields(financials)

    # Log final structure
    for stmt, data in financials.items():
        if data:
            logger.info("Final %s: periods=%s", stmt, list(data.keys()))
            for period, items in data.items():
                logger.info("  %s: %s", period, list(items.keys())[:10])

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
        first_cell = _clean_text(str(row.iloc[0])) if pd.notna(row.iloc[0]) else ""
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

        # Compute EBITDA if we have Operating Income and D&A
        if "EBITDA" not in data:
            op_income = data.get("Operating Income")
            da = data.get("Depreciation And Amortization")
            if op_income is not None and da is not None:
                data["EBITDA"] = op_income + abs(da)

        # Compute Operating Income from PBT + Interest if missing
        if "Operating Income" not in data:
            pbt = data.get("Pretax Income")
            interest = data.get("Interest Expense")
            other_income = data.get("Other Income", 0)
            if pbt is not None and interest is not None:
                data["Operating Income"] = pbt + abs(interest) - abs(other_income)


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
