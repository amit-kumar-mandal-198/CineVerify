"""Verification endpoint matching docs/api-contract.md (owned by Member 2)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter

from app.schemas.claim import ClaimRequest
from app.schemas.verdict import VerificationResponse
from app.services import (
    claim_extractor,
    evidence_retriever,
    explanation_gen,
    nli_verifier,
    verdict_engine,
)

router = APIRouter(prefix="/api", tags=["verification"])


@router.post("/verify", response_model=VerificationResponse)
async def verify_claim_endpoint(request: ClaimRequest) -> VerificationResponse:
    """Verify an Indian cinema claim and return an explainable report.

    Currently executes the modular stub pipeline so frontend and backend
    can integrate against the agreed API contract from Day 1.
    """
    claim_result = claim_extractor.extract_claim(request.claim, request.type)
    passages = await evidence_retriever.retrieve_evidence(claim_result)
    nli_results = nli_verifier.verify_claim(claim_result.core_claim, passages)
    verdict = verdict_engine.generate_verdict(claim_result, nli_results, passages)
    explanation = explanation_gen.generate_explanation(
        claim_result, verdict, passages, nli_results
    )

    # TODO(Member 2): Build EvidenceItem list from passages + nli_results and persist via crud.save_verification
    return VerificationResponse(
        id=str(uuid4()),
        submitted_claim=claim_result.submitted_claim,
        core_claim=claim_result.core_claim,
        verdict=verdict.verdict,
        confidence=verdict.confidence,
        category=claim_result.category,
        explanation=explanation,
        entities=claim_result.entities,
        evidence=[],
        verified_at=datetime.now(timezone.utc),
    )
