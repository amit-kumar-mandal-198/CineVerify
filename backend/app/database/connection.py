"""MongoDB connection manager (owned by Member 2)."""

from __future__ import annotations

from typing import Any, Optional

# TODO(Member 2): Initialize AsyncIOMotorClient using settings.MONGODB_URI
_client: Optional[Any] = None


def get_database() -> Any:
    """Return the configured MongoDB database instance."""
    raise NotImplementedError("Member 2: Implement MongoDB connection in database/connection.py")


async def close_database() -> None:
    """Close the MongoDB client cleanly on application shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
