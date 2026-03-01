import pdfplumber
import re
import os
from app.config import UPLOAD_DIR


# Keywords used to classify extracted tables as Income Statement, Balance Sheet, or Cash Flow
IS_KEYWORDS = [
    "revenue", "sales", "cost of", "gross profit", "operating", "ebitda",
    "net income", "earnings", "eps", "income tax", "interest expense",
]
BS_KEYWORDS = [
    "total assets", "total liabilities", "stockholders", "shareholders",
    "current assets", "current liabilities", "cash and", "accounts receivable",
    "inventory", "property", "goodwill", "long-term debt", "retained earnings",
]
CF_KEYWORDS = [
    "operating activities", "investing activities", "financing activities",
    "depreciation", "capital expenditure", "capex", "free cash flow",
    "change in working capital", "cash from",
]


def _classify_table(rows: list[list]) -> str:
    """Classify a table as 'income_statement', 'balance_sheet', or 'cash_flow'."""
    text = " ".join(
        str(cell).lower() for row in rows[:10] for cell in row if cell
    )
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


def _parse_number(val: str) -> float | None:
    """Try to parse a string as a number (handles parentheses for negatives, commas)."""
    if not val or not isinstance(val, str):
        return None
    val = val.strip()
    negative = False
    if val.startswith("(") and val.endswith(")"):
        negative = True
        val = val[1:-1]
    val = val.replace(",", "").replace("$", "").replace("%", "").strip()
    if val in ("", "-", "—", "–", "N/A", "n/a"):
        return None
    try:
        num = float(val)
        return -num if negative else num
    except ValueError:
        return None


def _table_to_dict(rows: list[list]) -> dict:
    """Convert extracted table rows into a structured dict.
    First column = line item labels, remaining columns = period values.
    """
    if not rows or len(rows) < 2:
        return {}
    headers = [str(h).strip() if h else f"Col_{i}" for i, h in enumerate(rows[0])]
    data = {}
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        label = str(row[0]).strip()
        if not label:
            continue
        values = {}
        for i, cell in enumerate(row[1:], 1):
            if i < len(headers):
                parsed = _parse_number(str(cell) if cell else "")
                values[headers[i]] = parsed
        data[label] = values
    return data


def parse_pdf(filename: str) -> dict:
    """Parse an uploaded PDF and extract financial tables."""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        return {"error": f"File not found: {filename}"}

    results = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
        "metadata": {"filename": filename, "pages": 0},
        "raw_text": "",
    }

    full_text_parts = []
    with pdfplumber.open(filepath) as pdf:
        results["metadata"]["pages"] = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text_parts.append(text)

            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                classification = _classify_table(table)
                parsed = _table_to_dict(table)
                if classification != "unknown" and parsed:
                    existing = results[classification]
                    existing.update(parsed)

    results["raw_text"] = "\n".join(full_text_parts)

    # Try to extract company name from first page
    first_page_text = full_text_parts[0] if full_text_parts else ""
    lines = [l.strip() for l in first_page_text.split("\n") if l.strip()]
    if lines:
        results["metadata"]["possible_company_name"] = lines[0]

    return results
