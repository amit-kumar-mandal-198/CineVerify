"""AWS DynamoDB CRUD operations for verification records (owned by Member 2)."""

from __future__ import annotations

import asyncio
import json
from decimal import Decimal
from typing import Any, List, Optional

from app.database.connection import get_verifications_table
from app.schemas.verdict import HistoryItem, VerificationResponse


def _to_dynamodb_item(report: VerificationResponse) -> dict[str, Any]:
    """Serialize VerificationResponse to DynamoDB-compatible dict (float -> Decimal)."""
    return json.loads(report.model_dump_json(), parse_float=Decimal)


def _decimals_to_floats(value: Any) -> Any:
    """Recursively convert DynamoDB Decimal values back into Python float/int."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, list):
        return [_decimals_to_floats(item) for item in value]
    if isinstance(value, dict):
        return {key: _decimals_to_floats(val) for key, val in value.items()}
    return value


def _put_item_sync(item: dict[str, Any]) -> None:
    get_verifications_table().put_item(Item=item)


def _scan_history_sync() -> list[dict[str, Any]]:
    table = get_verifications_table()
    # Alias reserved keyword 'id' safely via ExpressionAttributeNames if needed;
    # ProjectionExpression only pulls lightweight summary fields for history.
    response = table.scan(
        ProjectionExpression="#id, submitted_claim, verdict, confidence, category, verified_at",
        ExpressionAttributeNames={"#id": "id"},
    )
    items = list(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(
            ProjectionExpression="#id, submitted_claim, verdict, confidence, category, verified_at",
            ExpressionAttributeNames={"#id": "id"},
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))
    return items


def _get_item_sync(report_id: str) -> Optional[dict[str, Any]]:
    response = get_verifications_table().get_item(Key={"id": report_id})
    return response.get("Item")


async def save_verification(report: VerificationResponse) -> str:
    """Persist a completed verification report in DynamoDB and return its ID."""
    item = _to_dynamodb_item(report)
    await asyncio.to_thread(_put_item_sync, item)
    return report.id


async def get_history(limit: int = 20) -> List[HistoryItem]:
    """Fetch recent verification history items sorted newest first."""
    raw_items = await asyncio.to_thread(_scan_history_sync)
    parsed = [HistoryItem(**_decimals_to_floats(doc)) for doc in raw_items]
    parsed.sort(key=lambda item: item.verified_at, reverse=True)
    return parsed[:limit]


async def get_verification_by_id(report_id: str) -> Optional[VerificationResponse]:
    """Retrieve a full verification report by its ID, or None if not found."""
    raw = await asyncio.to_thread(_get_item_sync, report_id)
    if raw is None:
        return None
    return VerificationResponse(**_decimals_to_floats(raw))
