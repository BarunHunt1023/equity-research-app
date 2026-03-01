import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import UPLOAD_DIR
from app.services.pdf_parser import parse_pdf

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF annual report and extract financial data."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save with unique name
    ext = os.path.splitext(file.filename)[1]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        result = parse_pdf(safe_name)
        result["original_filename"] = file.filename
        return result
    except Exception as e:
        # Clean up on error
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")
