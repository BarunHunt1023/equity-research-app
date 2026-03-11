import logging
import os
import uuid
import traceback
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.config import UPLOAD_DIR
from app.services.pdf_parser import parse_pdf
from app.services.spreadsheet_parser import parse_excel, parse_csv
from app.services import financial_analysis

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls"}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    ticker: Optional[str] = Form(None),
):
    """Upload financial data (Excel, CSV, or PDF) and return full analysis."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Save with unique name
    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        # Parse based on file type
        if ext == ".pdf":
            parsed = parse_pdf(safe_name)
            financials = {
                "income_statement": parsed.get("income_statement", {}),
                "balance_sheet": parsed.get("balance_sheet", {}),
                "cash_flow": parsed.get("cash_flow", {}),
            }
        elif ext == ".csv":
            financials = parse_csv(filepath)
        else:  # .xlsx, .xls
            financials = parse_excel(filepath)

        # Log parsed financial structure for debugging
        for stmt_type, stmt_data in financials.items():
            if stmt_data:
                logger.info("Parsed %s: periods=%s", stmt_type, list(stmt_data.keys()))
                for period, items in stmt_data.items():
                    logger.info("  %s: fields=%s", period, list(items.keys()))
            else:
                logger.info("Parsed %s: empty", stmt_type)

        # Compute ratios and historical metrics
        ratios = financial_analysis.compute_ratios(financials)
        historical = financial_analysis.compute_historical_metrics(financials)
        logger.info("Computed %d historical metric periods", len(historical))
        logger.info("Ratios raw_values: revenue=%s, net_income=%s, ebitda=%s",
                     ratios.get("raw_values", {}).get("revenue"),
                     ratios.get("raw_values", {}).get("net_income"),
                     ratios.get("raw_values", {}).get("ebitda"))

        # Build company_info stub
        ticker_str = (ticker or "UPLOADED").upper().strip()
        company_info = {
            "ticker": ticker_str,
            "name": ticker_str,
            "sector": "N/A",
            "industry": "N/A",
            "country": "N/A",
            "market_cap": None,
            "enterprise_value": None,
            "current_price": None,
            "currency": "INR",
            "unit": "Cr",
            "shares_outstanding": None,
            "beta": None,
            "trailing_pe": None,
            "forward_pe": None,
            "dividend_yield": None,
            "fifty_two_week_high": None,
            "fifty_two_week_low": None,
            "description": f"Financial data uploaded from {file.filename}",
        }

        # Return same format as /analyze endpoint
        return {
            "company_info": company_info,
            "financials": financials,
            "historical_prices": [],
            "ratios": ratios,
            "historical_metrics": historical,
        }

    except Exception as e:
        logger.error("Failed to parse file %s: %s\n%s", file.filename, str(e), traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")
    finally:
        # Clean up uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)


@router.post("/upload/debug")
async def upload_file_debug(
    file: UploadFile = File(...),
):
    """Debug endpoint: upload a file and return raw parsing results with diagnostics."""
    import pandas as pd

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        debug_info = {"filename": file.filename, "size_bytes": len(content)}

        if ext in (".xlsx", ".xls"):
            xl = pd.ExcelFile(filepath)
            debug_info["sheets"] = xl.sheet_names

            # Read raw data from each sheet (first 5 rows)
            sheet_previews = {}
            for sheet_name in xl.sheet_names:
                df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
                preview = []
                for i in range(min(5, len(df_raw))):
                    row_data = []
                    for val in df_raw.iloc[i]:
                        if pd.isna(val):
                            row_data.append(None)
                        else:
                            row_data.append(str(val))
                    preview.append(row_data)
                sheet_previews[sheet_name] = {
                    "shape": list(df_raw.shape),
                    "first_rows": preview,
                }
            debug_info["sheet_previews"] = sheet_previews

            # Parse and show results
            financials = parse_excel(filepath)
            debug_info["parsed"] = {}
            for stmt_type, stmt_data in financials.items():
                if stmt_data:
                    debug_info["parsed"][stmt_type] = {
                        "periods": list(stmt_data.keys()),
                        "fields_per_period": {
                            period: list(items.keys())
                            for period, items in stmt_data.items()
                        },
                    }
                else:
                    debug_info["parsed"][stmt_type] = "EMPTY"

            ratios = financial_analysis.compute_ratios(financials)
            debug_info["raw_values"] = ratios.get("raw_values", {})

        return debug_info

    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)
