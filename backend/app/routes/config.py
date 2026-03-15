from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import get_anthropic_key, set_anthropic_key

router = APIRouter()


class SetKeyRequest(BaseModel):
    api_key: str


@router.get("/config/status")
def config_status():
    """Return whether the Anthropic API key is configured."""
    return {"anthropic_configured": bool(get_anthropic_key())}


@router.post("/config/set-key")
def config_set_key(req: SetKeyRequest):
    """Set the Anthropic API key at runtime and persist it to disk."""
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="api_key must not be empty.")
    set_anthropic_key(key)
    return {"ok": True}
