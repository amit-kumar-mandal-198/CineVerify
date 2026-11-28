"""Verification history endpoints matching docs/api-contract.md (owned by Member 2)."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query, Response, status
from botocore.exceptions import BotoCoreError, ClientError

from app.database import crud
from app.schemas.verdict import HistoryItem, VerificationResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history", response_model=List[HistoryItem])
async def get_verification_history(
    limit: int = Query(default=20, ge=1, le=100),
) -> List[HistoryItem]:
    """Return past verification reports sorted newest first."""
    try:
        return await crud.get_history(limit=limit)
    except (BotoCoreError, ClientError) as exc:
        logger.warning("AWS DynamoDB unavailable while reading history: %s", exc)
        return []


@router.get("/history/{report_id}", response_model=VerificationResponse)
async def get_verification_detail(report_id: str) -> VerificationResponse:
    """Return a single full verification report by ID."""
    try:
        report = await crud.get_verification_by_id(report_id)
    except (BotoCoreError, ClientError) as exc:
        logger.warning(
            "AWS DynamoDB unavailable while reading report %s: %s",
            report_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification history storage is temporarily unavailable.",
        ) from exc

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification report not found.",
        )

    return report


@router.delete("/history/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_verification_entry(report_id: str) -> Response:
    """Delete a stored verification report by ID."""
    try:
        deleted = await crud.delete_verification(report_id)
    except (BotoCoreError, ClientError) as exc:
        logger.warning(
            "AWS DynamoDB unavailable while deleting report %s: %s",
            report_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification history storage is temporarily unavailable.",
        ) from exc

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification report not found.",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
