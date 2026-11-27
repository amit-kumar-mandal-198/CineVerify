"""Database CRUD operations for verification records (owned by Member 2)."""

from __future__ import annotations

from typing import List

from app.schemas.verdict import HistoryItem, VerificationResponse


async def save_verification(report: VerificationResponse) -> str:
    """Persist a completed verification report and return its record ID."""
    # TODO(Member 2): Insert report.model_dump(mode="json") into MongoDB verifications collection
    return report.id


async def get_history(limit: int = 20) -> List[HistoryItem]:
    """Fetch recent verification history items sorted newest first."""
    # TODO(Member 2): Query MongoDB verifications collection sorted by verified_at desc
    return []
