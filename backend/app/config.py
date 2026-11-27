"""Application configuration and source credibility tiers."""

from __future__ import annotations

import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Runtime settings loaded from environment variables."""

    APP_NAME: str = "CineVerify AI Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")

    # AWS DynamoDB (Always Free Tier)
    AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    DYNAMODB_TABLE_NAME: str = os.getenv("DYNAMODB_TABLE_NAME", "cineverify_verifications")


settings = Settings()

# Initial domain credibility map for Indian cinema & entertainment reporting.
# Owned and refined jointly by Member 1 & Member 2.
SOURCE_CREDIBILITY: dict[str, float] = {
    # Tier 1: Established film trade & dedicated cinema publications
    "filmcompanion.in": 0.95,
    "bollywoodhungama.com": 0.90,
    "sacnilk.com": 0.90,
    "ormaxmedia.com": 0.92,
    # Tier 2: Mainstream national entertainment desks
    "hindustantimes.com": 0.85,
    "ndtv.com": 0.85,
    "indianexpress.com": 0.85,
    "thehindu.com": 0.85,
    "timesofindia.indiatimes.com": 0.78,
    "pinkvilla.com": 0.72,
    # Tier 3: Mixed / aggregator portals
    "koimoi.com": 0.62,
    "zeenews.india.com": 0.55,
    "dnaindia.com": 0.55,
}

DEFAULT_SOURCE_CREDIBILITY: float = 0.40


def get_source_credibility(url: str) -> float:
    """Return a credibility score in [0.0, 1.0] for a given source URL."""
    hostname = (urlparse(url).hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]

    if hostname in SOURCE_CREDIBILITY:
        return SOURCE_CREDIBILITY[hostname]

    for domain, score in SOURCE_CREDIBILITY.items():
        if hostname.endswith(f".{domain}"):
            return score

    return DEFAULT_SOURCE_CREDIBILITY
