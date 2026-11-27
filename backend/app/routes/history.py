"""Verification history endpoint matching docs/api-contract.md (owned by Member 2)."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Query

from app.database import crud
from app.schemas.verdict import HistoryItem

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history", response_model=List[HistoryItem])
async def get_verification_history(
    limit: int = Query(default=20, ge=1, le=100),
) -> List[HistoryItem]:
    """Return past verification reports sorted newest first."""
    return await crud.get_history(limit=limit)
