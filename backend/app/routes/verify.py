"""Verification endpoints matching docs/api-contract.md (owned by Member 2)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncIterator, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from botocore.exceptions import BotoCoreError, ClientError

from app.database import crud
from app.schemas.claim import ClaimRequest, InputType
from app.schemas.evidence import EvidenceItem, EvidencePassage, SearchResult, StanceLabel
from app.schemas.verdict import (
    FollowUpRequest,
    FollowUpResponse,
    NLIResult,
    VerificationResponse,
)
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
_REPORT_CACHE_TTL_SECONDS = 600.0
_MAX_REPORT_CACHE_SIZE = 64
_REPORT_TTL_CACHE: Dict[str, tuple[float, VerificationResponse]] = {}
_BACKGROUND_TASKS: set[asyncio.Task[None]] = set()


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


def _cache_key(claim: str, input_type: InputType) -> str:
    return f"{input_type.value}::{' '.join(claim.lower().split())}"


def _get_cached_report(claim: str, input_type: InputType) -> Optional[VerificationResponse]:
    key = _cache_key(claim, input_type)
    entry = _REPORT_TTL_CACHE.get(key)
    if entry is None:
        return None
    expires_at, report = entry
    if time.monotonic() > expires_at:
        _REPORT_TTL_CACHE.pop(key, None)
        return None
    return report


def _store_cached_report(claim: str, input_type: InputType, report: VerificationResponse) -> None:
    key = _cache_key(claim, input_type)
    _REPORT_TTL_CACHE[key] = (time.monotonic() + _REPORT_CACHE_TTL_SECONDS, report)
    while len(_REPORT_TTL_CACHE) > _MAX_REPORT_CACHE_SIZE:
        oldest = next(iter(_REPORT_TTL_CACHE))
        _REPORT_TTL_CACHE.pop(oldest, None)


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


async def _persist_quietly(response: VerificationResponse) -> None:
    try:
        await crud.save_verification(response)
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Failed to persist verification %s to DynamoDB: %s", response.id, exc)
    except Exception as exc:
        logger.warning("Unexpected error persisting verification %s: %s", response.id, exc)


def _schedule_background_persist(response: VerificationResponse) -> None:
    crud._remember_report(response)
    task = asyncio.create_task(_persist_quietly(response))
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


async def _speculative_search(cleaned_claim: str, input_type: InputType) -> List[SearchResult]:
    if input_type != InputType.TEXT:
        return []
    try:
        return await asyncio.to_thread(evidence_retriever.search_web, cleaned_claim)
    except Exception as exc:
        logger.debug("Speculative web search skipped (%s)", exc)
        return []


@router.post("/verify", response_model=VerificationResponse)
async def verify_claim_endpoint(request: ClaimRequest) -> VerificationResponse:
    """Verify an Indian cinema claim and return an explainable report."""
    cleaned_claim = request.claim.strip()
    if len(cleaned_claim) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim must contain at least 3 non-whitespace characters.",
        )

    cached = _get_cached_report(cleaned_claim, request.type)
    if cached is not None:
        return cached

    try:
        claim_task = asyncio.to_thread(
            claim_extractor.extract_claim,
            cleaned_claim,
            request.type,
        )
        speculative_task = _speculative_search(cleaned_claim, request.type)
        claim_result, prefetched = await asyncio.gather(claim_task, speculative_task)

        passages = await evidence_retriever.retrieve_evidence(
            claim_result,
            prefetched_results=prefetched,
            prefetched_query=cleaned_claim if request.type == InputType.TEXT else None,
        )
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
        comparisons = explanation_gen.build_claim_comparisons(
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
        claim_comparisons=comparisons,
        verified_at=datetime.now(timezone.utc),
    )

    _store_cached_report(cleaned_claim, request.type, response)
    _schedule_background_persist(response)
    return response


@router.post("/verify/stream")
async def verify_claim_stream_endpoint(request: ClaimRequest) -> StreamingResponse:
    """Stream real pipeline stage progress via Server-Sent Events and emit final report."""
    cleaned_claim = request.claim.strip()
    if len(cleaned_claim) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim must contain at least 3 non-whitespace characters.",
        )

    async def event_generator() -> AsyncIterator[str]:
        cached = _get_cached_report(cleaned_claim, request.type)
        if cached is not None:
            yield _sse_event({
                "stage": "extracting_claim",
                "status": "done",
                "step": 0,
                "detail": cached.category.value.replace("_", " ").title(),
            })
            yield _sse_event({
                "stage": "searching_sources",
                "status": "done",
                "step": 1,
                "detail": f"{len(cached.evidence)} cached",
            })
            yield _sse_event({
                "stage": "nli_comparison",
                "status": "done",
                "step": 2,
                "detail": cached.verdict.value,
            })
            yield _sse_event({
                "stage": "complete",
                "status": "done",
                "step": 3,
                "report": cached.model_dump(mode="json"),
            })
            return

        try:
            yield _sse_event({"stage": "extracting_claim", "status": "running", "step": 0})
            claim_task = asyncio.to_thread(
                claim_extractor.extract_claim,
                cleaned_claim,
                request.type,
            )
            speculative_task = asyncio.create_task(_speculative_search(cleaned_claim, request.type))

            try:
                claim_result = await claim_task
            except Exception:
                speculative_task.cancel()
                raise

            yield _sse_event({
                "stage": "extracting_claim",
                "status": "done",
                "step": 0,
                "detail": claim_result.category.value.replace("_", " ").title(),
            })

            yield _sse_event({"stage": "searching_sources", "status": "running", "step": 1})
            prefetched = await speculative_task
            passages = await evidence_retriever.retrieve_evidence(
                claim_result,
                prefetched_results=prefetched,
                prefetched_query=cleaned_claim if request.type == InputType.TEXT else None,
            )
            unique_sources = len({p.url for p in passages})
            yield _sse_event({
                "stage": "searching_sources",
                "status": "done",
                "step": 1,
                "detail": f"{unique_sources} sources" if unique_sources else "No matches",
            })

            yield _sse_event({"stage": "nli_comparison", "status": "running", "step": 2})
            nli_results = await asyncio.to_thread(
                nli_verifier.verify_claim,
                claim_result.core_claim,
                passages,
            )
            verdict = verdict_engine.generate_verdict(claim_result, nli_results, passages)
            yield _sse_event({
                "stage": "nli_comparison",
                "status": "done",
                "step": 2,
                "detail": verdict.verdict.value,
            })

            yield _sse_event({"stage": "generating_report", "status": "running", "step": 3})
            explanation = await asyncio.to_thread(
                explanation_gen.generate_explanation,
                claim_result,
                verdict,
                passages,
                nli_results,
            )
            comparisons = explanation_gen.build_claim_comparisons(
                claim_result,
                verdict,
                passages,
                nli_results,
            )
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
                claim_comparisons=comparisons,
                verified_at=datetime.now(timezone.utc),
            )

            _store_cached_report(cleaned_claim, request.type, response)
            _schedule_background_persist(response)

            yield _sse_event({
                "stage": "complete",
                "status": "done",
                "step": 3,
                "report": response.model_dump(mode="json"),
            })
        except ValueError as exc:
            yield _sse_event({"stage": "error", "detail": str(exc)})
        except Exception as exc:
            logger.exception("Streaming verification pipeline failed: %s", exc)
            yield _sse_event({
                "stage": "error",
                "detail": "Verification pipeline encountered an internal error.",
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/verify/followup", response_model=FollowUpResponse)
async def verify_followup_endpoint(request: FollowUpRequest) -> FollowUpResponse:
    """Answer follow-up questions strictly grounded in the retrieved verification evidence."""
    cleaned_question = request.question.strip()
    if len(cleaned_question) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Follow-up question cannot be empty.",
        )

    return await asyncio.to_thread(explanation_gen.answer_followup_question, request)
