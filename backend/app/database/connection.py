"""AWS DynamoDB connection manager (owned by Member 2)."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

_dynamodb_resource: Optional[Any] = None
_dynamodb_client: Optional[Any] = None

_BOTO_CONFIG = Config(
    connect_timeout=3,
    read_timeout=5,
    retries={"max_attempts": 1},
)


def _has_explicit_credentials() -> bool:
    key_id = settings.AWS_ACCESS_KEY_ID.strip()
    secret = settings.AWS_SECRET_ACCESS_KEY.strip()
    return (
        bool(key_id)
        and bool(secret)
        and not key_id.startswith("your_")
        and not secret.startswith("your_")
    )


def _session_kwargs() -> dict[str, str]:
    kwargs: dict[str, str] = {"region_name": settings.AWS_REGION}
    if _has_explicit_credentials():
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID.strip()
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY.strip()
    return kwargs


def get_dynamodb_resource() -> Any:
    """Return a cached boto3 DynamoDB ServiceResource."""
    global _dynamodb_resource
    if _dynamodb_resource is None:
        _dynamodb_resource = boto3.resource(
            "dynamodb",
            config=_BOTO_CONFIG,
            **_session_kwargs(),
        )
    return _dynamodb_resource


def get_dynamodb_client() -> Any:
    """Return a cached boto3 low-level DynamoDB client."""
    global _dynamodb_client
    if _dynamodb_client is None:
        _dynamodb_client = boto3.client(
            "dynamodb",
            config=_BOTO_CONFIG,
            **_session_kwargs(),
        )
    return _dynamodb_client


def get_verifications_table() -> Any:
    """Return the DynamoDB Table resource for verification reports."""
    return get_dynamodb_resource().Table(settings.DYNAMODB_TABLE_NAME)


def ensure_table_exists_sync(
    read_capacity_units: int = 5,
    write_capacity_units: int = 5,
) -> str:
    """Create the DynamoDB table in Always-Free Provisioned mode if missing."""
    client = get_dynamodb_client()
    table_name = settings.DYNAMODB_TABLE_NAME
    try:
        client.describe_table(TableName=table_name)
        return "exists"
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise

    client.create_table(
        TableName=table_name,
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
        BillingMode="PROVISIONED",
        ProvisionedThroughput={
            "ReadCapacityUnits": read_capacity_units,
            "WriteCapacityUnits": write_capacity_units,
        },
    )
    waiter = client.get_waiter("table_exists")
    waiter.wait(TableName=table_name)
    return "created"


async def ping_database() -> bool:
    """Verify live AWS DynamoDB connectivity and table presence."""
    client = get_dynamodb_client()
    response = await asyncio.to_thread(
        client.describe_table,
        TableName=settings.DYNAMODB_TABLE_NAME,
    )
    return response.get("Table", {}).get("TableName") == settings.DYNAMODB_TABLE_NAME


async def close_database() -> None:
    """Reset cached boto3 resources on application shutdown."""
    global _dynamodb_resource, _dynamodb_client
    _dynamodb_resource = None
    _dynamodb_client = None
