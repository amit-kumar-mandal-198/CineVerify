"""Verification endpoint matching docs/api-contract.md (owned by Member 2)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from botocore.exceptions import BotoCoreError, ClientError

from app.database import crud
from app.schemas.claim import ClaimRequest
from app.schemas.evidence import EvidenceItem, EvidencePassage, StanceLabel
from app.schemas.verdict import NLIResult, VerificationResponse
from app.services import (
    claim_extractor,
    evidence_retriever,
    explanation_gen,
    nli_verifier,
    verdict_engine,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["verification"])

_MAX_SNIPPET_CHARS = 320


def _truncate_snippet(text: str, limit: int = _MAX_SNIPPET_CHARS) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _build_evidence_items(
    passages: List[EvidencePassage],
    nli_results: List[NLIResult],
) -> List[EvidenceItem]:
    """Assemble deduplicated, credibility-sorted EvidenceItem objects for the API response."""
    stance_by_index: Dict[int, NLIResult] = {
        result.passage_index: result for result in nli_results
    }

    best_by_url: Dict[str, tuple[float, EvidenceItem]] = {}
    for idx, passage in enumerate(passages):
        nli = stance_by_index.get(idx)
        stance = nli.stance if nli else StanceLabel.NEUTRAL
        nli_conf = nli.confidence if nli else 0.0
        # Prioritize non-neutral evidence and higher-credibility sources per URL.
        rank_score = passage.credibility_score + (
            0.5 * nli_conf if stance != StanceLabel.NEUTRAL else 0.0
        )

        item = EvidenceItem(
            source_name=passage.source_name,
            url=passage.url,
            title=passage.title,
            published_date=passage.published_date,
            stance=stance,
            snippet=_truncate_snippet(passage.text),
            credibility_score=passage.credibility_score,
        )

        existing = best_by_url.get(passage.url)
        if existing is None or rank_score > existing[0]:
            best_by_url[passage.url] = (rank_score, item)

    ranked_items = [pair[1] for pair in sorted(best_by_url.values(), key=lambda p: p[0], reverse=True)]
    return ranked_items


@router.post("/verify", response_model=VerificationResponse)
async def verify_claim_endpoint(request: ClaimRequest) -> VerificationResponse:
    """Verify an Indian cinema claim and return an explainable report."""
    cleaned_claim = request.claim.strip()
    if len(cleaned_claim) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim must contain at least 3 non-whitespace characters.",
        )

    try:
        claim_result = await asyncio.to_thread(
            claim_extractor.extract_claim,
            cleaned_claim,
            request.type,
        )
        passages = await evidence_retriever.retrieve_evidence(claim_result)
        nli_results = await asyncio.to_thread(
            nli_verifier.verify_claim,
            claim_result.core_claim,
            passages,
        )
        verdict = verdict_engine.generate_verdict(claim_result, nli_results, passages)
        explanation = await asyncio.to_thread(
            explanation_gen.generate_explanation,
            claim_result,
            verdict,
            passages,
            nli_results,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Verification pipeline failed unexpectedly: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Verification pipeline encountered an internal error.",
        ) from exc

    evidence_items = _build_evidence_items(passages, nli_results)
    response = VerificationResponse(
        id=str(uuid4()),
        submitted_claim=claim_result.submitted_claim,
        core_claim=claim_result.core_claim,
        verdict=verdict.verdict,
        confidence=verdict.confidence,
        category=claim_result.category,
        explanation=explanation,
        entities=claim_result.entities,
        evidence=evidence_items,
        verified_at=datetime.now(timezone.utc),
    )

    try:
        await crud.save_verification(response)
    except (BotoCoreError, ClientError) as exc:
        # Persistence failure should not discard a computed verification report.
        logger.warning("Failed to persist verification %s to DynamoDB: %s", response.id, exc)

    return response
