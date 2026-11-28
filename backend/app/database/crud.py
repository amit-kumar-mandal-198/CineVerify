"""AWS DynamoDB CRUD operations for verification records (owned by Member 2)."""

from __future__ import annotations

import asyncio
import json
from decimal import Decimal
from typing import Any, List, Optional

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.database.connection import get_verifications_table
from app.schemas.verdict import HistoryItem, VerificationResponse

_HISTORY_GSI_NAME = "record_type-verified_at-index"
_RECORD_TYPE_VALUE = "verification"
_MAX_IN_MEMORY_RECENT = 64
_RECENT_REPORTS: dict[str, VerificationResponse] = {}


def _to_dynamodb_item(report: VerificationResponse) -> dict[str, Any]:
    """Serialize VerificationResponse to DynamoDB-compatible dict (float -> Decimal)."""
    payload = json.loads(report.model_dump_json(), parse_float=Decimal)
    payload["record_type"] = _RECORD_TYPE_VALUE
    return payload


def _decimals_to_floats(value: Any) -> Any:
    """Recursively convert DynamoDB Decimal values back into Python float/int."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, list):
        return [_decimals_to_floats(item) for item in value]
    if isinstance(value, dict):
        return {key: _decimals_to_floats(val) for key, val in value.items()}
    return value


def _remember_report(report: VerificationResponse) -> None:
    _RECENT_REPORTS[report.id] = report
    while len(_RECENT_REPORTS) > _MAX_IN_MEMORY_RECENT:
        oldest_key = next(iter(_RECENT_REPORTS))
        _RECENT_REPORTS.pop(oldest_key, None)


def _put_item_sync(item: dict[str, Any]) -> None:
    get_verifications_table().put_item(Item=item)


def _query_history_gsi_sync(limit: int) -> list[dict[str, Any]]:
    table = get_verifications_table()
    response = table.query(
        IndexName=_HISTORY_GSI_NAME,
        KeyConditionExpression=Key("record_type").eq(_RECORD_TYPE_VALUE),
        ScanIndexForward=False,
        Limit=limit,
    )
    return list(response.get("Items", []))


def _scan_history_sync() -> list[dict[str, Any]]:
    table = get_verifications_table()
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


def _get_history_items_sync(limit: int) -> list[dict[str, Any]]:
    """Prefer GSI query sorted newest-first; fall back to scan if table lacks GSI."""
    try:
        gsi_items = _query_history_gsi_sync(limit)
        if gsi_items:
            return gsi_items
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code != "ValidationException":
            raise
    return _scan_history_sync()


def _get_item_sync(report_id: str) -> Optional[dict[str, Any]]:
    response = get_verifications_table().get_item(Key={"id": report_id})
    return response.get("Item")


def _delete_item_sync(report_id: str) -> bool:
    response = get_verifications_table().delete_item(
        Key={"id": report_id},
        ReturnValues="ALL_OLD",
    )
    return "Attributes" in response


async def save_verification(report: VerificationResponse) -> str:
    """Cache in-memory immediately and persist a verification report in DynamoDB."""
    _remember_report(report)
    item = _to_dynamodb_item(report)
    await asyncio.to_thread(_put_item_sync, item)
    return report.id


async def get_history(limit: int = 20) -> List[HistoryItem]:
    """Fetch recent verification history items sorted newest first."""
    raw_items = await asyncio.to_thread(_get_history_items_sync, limit)
    parsed = [HistoryItem(**_decimals_to_floats(doc)) for doc in raw_items]
    parsed.sort(key=lambda item: item.verified_at, reverse=True)
    return parsed[:limit]


async def get_verification_by_id(report_id: str) -> Optional[VerificationResponse]:
    """Retrieve a full verification report by its ID, or None if not found."""
    cached = _RECENT_REPORTS.get(report_id)
    if cached is not None:
        return cached
    raw = await asyncio.to_thread(_get_item_sync, report_id)
    if raw is None:
        return None
    report = VerificationResponse(**_decimals_to_floats(raw))
    _remember_report(report)
    return report


async def delete_verification(report_id: str) -> bool:
    """Delete a stored verification report by ID. Returns True if an item was removed."""
    _RECENT_REPORTS.pop(report_id, None)
    return await asyncio.to_thread(_delete_item_sync, report_id)
