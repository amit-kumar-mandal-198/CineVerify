"""FastAPI entry point for CineVerify AI backend (owned by Member 2)."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.connection import close_database
from app.routes import history, verify
from app.services.evidence_retriever import _get_embedding_model
from app.services.nli_verifier import _get_nli_model


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Preload cached ML models in parallel at startup so the first request has zero cold-start lag."""
    await asyncio.gather(
        asyncio.to_thread(_get_nli_model),
        asyncio.to_thread(_get_embedding_model),
    )
    yield
    await close_database()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Indian Cinema News & Rumour Verification API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(verify.router)
app.include_router(history.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Service liveness endpoint."""
    return {
        "status": "ok",
        "service": "cineverify-backend",
        "version": settings.APP_VERSION,
    }
