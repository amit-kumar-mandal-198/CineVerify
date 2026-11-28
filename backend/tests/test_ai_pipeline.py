"""Offline & integration tests for the unified local CineVerify SLM verification pipeline."""

from __future__ import annotations

import argparse
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from app.schemas.claim import ClaimCategory, ClaimResult, ExtractedEntities, InputType
from app.schemas.evidence import EvidenceItem, EvidencePassage, StanceLabel
from app.schemas.verdict import FollowUpRequest, NLIResult, VerdictLabel
from app.services.claim_extractor import extract_claim
from app.services.evidence_retriever import select_best_chunks_batch, select_relevant_chunks
from app.services.explanation_gen import (
    answer_followup_question,
    build_claim_comparisons,
    generate_explanation,
)
from app.services.nli_verifier import verify_claim
from app.services.verdict_engine import generate_verdict


def _make_passage(source: str, text: str, published_date: str | None, credibility: float) -> EvidencePassage:
    return EvidencePassage(
        source_name=source,
        url=f"https://{source.lower().replace(' ', '')}.example.com/article",
        title=f"{source} report",
        published_date=published_date,
        text=text,
        credibility_score=credibility,
    )


def test_claim_extractor_offline() -> None:
    """Empty input guard, local SLM mock parsing, heuristic fallback, and URL extraction."""
    try:
        extract_claim("   ", InputType.TEXT)
        raise AssertionError("Expected ValueError on empty claim input")
    except ValueError:
        pass

    with patch("app.services.claim_extractor.extract_claim_with_slm", return_value=None):
        res_box = extract_claim("Kalki 2898 AD crosses 1000 crore worldwide", InputType.TEXT)
        assert res_box.category == ClaimCategory.BOX_OFFICE
        assert res_box.submitted_claim == "Kalki 2898 AD crosses 1000 crore worldwide"
        assert res_box.entities.movie == "Kalki 2898 AD"

    mock_slm = {
        "core_claim": "Deepika Padukone joined Spirit opposite Prabhas.",
        "category": "casting",
        "entities": {
            "movie": "Spirit",
            "person": "Deepika Padukone",
            "production_house": None,
            "date": None,
            "platform": None,
            "amount": None,
        },
    }
    with patch("app.services.claim_extractor.extract_claim_with_slm", return_value=mock_slm):
        res_cast = extract_claim("Deepika Padukone joins Spirit opposite Prabhas", InputType.TEXT)
        assert res_cast.category == ClaimCategory.CASTING
        assert res_cast.entities.movie == "Spirit"
        assert res_cast.entities.person == "Deepika Padukone"

    with (
        patch("app.services.claim_extractor.trafilatura.fetch_url", return_value="<html></html>"),
        patch("app.services.claim_extractor.trafilatura.extract", return_value="Pushpa 3 releasing on Christmas 2027."),
        patch("app.services.claim_extractor.trafilatura.extract_metadata", return_value=SimpleNamespace(title="Release News")),
        patch("app.services.claim_extractor.extract_claim_with_slm", return_value=None),
    ):
        res_url = extract_claim("https://example.com/pushpa3", InputType.URL)
        assert res_url.submitted_claim == "https://example.com/pushpa3"
        assert res_url.category == ClaimCategory.RELEASE_UPDATE

    print("[PASS] Step 2 offline tests passed.")


def test_nli_verifier_offline() -> None:
    """Empty guard and entity-aware local stance verification across 3 classes."""
    assert verify_claim("Some claim", []) == []

    passages = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 arrives in 2027.", "2026-11-20", 0.90),
        _make_passage("Film Companion", "Studio denied reports of Pushpa 3 releasing in 2027.", "2026-11-21", 0.95),
        _make_passage("Indian Express", "Allu Arjun attended an award function in Mumbai.", "2026-11-22", 0.85),
    ]
    results = verify_claim("Pushpa 3 releases on Christmas 2027.", passages, movie_name="Pushpa 3")

    assert len(results) == 3
    assert results[0].stance == StanceLabel.SUPPORTS and results[0].confidence >= 0.85
    assert results[1].stance == StanceLabel.CONTRADICTS and results[1].confidence >= 0.85
    assert results[2].stance == StanceLabel.NEUTRAL
    print("[PASS] Step 3 offline tests passed.")


def test_verdict_engine_all_four_outcomes() -> None:
    """Synthetic NLI + EvidencePassage inputs verifying all 4 verdicts."""
    recent_date = date.today().isoformat()
    old_date = (date.today() - timedelta(days=365)).isoformat()

    claim = ClaimResult(
        submitted_claim="Pushpa 3 releasing on Christmas 2027",
        core_claim="Pushpa 3 will release on Christmas 2027.",
        category=ClaimCategory.RELEASE_UPDATE,
        entities=ExtractedEntities(movie="Pushpa 3", date="Christmas 2027"),
    )

    passages_verified = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 arrives on Christmas 2027.", recent_date, 0.90),
        _make_passage("Indian Express", "Pushpa 3 is slated for a Christmas 2027 theatrical release.", recent_date, 0.85),
    ]
    nli_verified = [
        NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.92),
        NLIResult(passage_index=1, stance=StanceLabel.SUPPORTS, confidence=0.88),
    ]
    res_verified = generate_verdict(claim, nli_verified, passages_verified)
    assert res_verified.verdict == VerdictLabel.VERIFIED

    passages_false = [
        _make_passage("Film Companion", "Mythri Movie Makers denied reports of Pushpa 3 releasing in 2027.", recent_date, 0.95),
    ]
    nli_false = [NLIResult(passage_index=0, stance=StanceLabel.CONTRADICTS, confidence=0.91)]
    res_false = generate_verdict(claim, nli_false, passages_false)
    assert res_false.verdict == VerdictLabel.FALSE

    passages_conflict = [
        _make_passage("Bollywood Hungama", "Pushpa 3 locked for Christmas 2027.", recent_date, 0.90),
        _make_passage("Hindustan Times", "Studio clarified Pushpa 3 is not releasing in 2027.", recent_date, 0.85),
    ]
    nli_conflict = [
        NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.86),
        NLIResult(passage_index=1, stance=StanceLabel.CONTRADICTS, confidence=0.89),
    ]
    res_conflict = generate_verdict(claim, nli_conflict, passages_conflict)
    assert res_conflict.verdict == VerdictLabel.MISLEADING

    outdated_claim = ClaimResult(
        submitted_claim="Actor X walks out of Project Y",
        core_claim="Actor X walked out of Project Y.",
        category=ClaimCategory.CASTING,
        entities=ExtractedEntities(person="Actor X", movie="Project Y"),
    )
    passages_outdated = [_make_passage("Pinkvilla", "Actor X exited Project Y amid scheduling issues.", old_date, 0.72)]
    nli_outdated = [NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.90)]
    res_outdated = generate_verdict(outdated_claim, nli_outdated, passages_outdated)
    assert res_outdated.verdict == VerdictLabel.MISLEADING

    assert generate_verdict(claim, [], []).verdict == VerdictLabel.UNVERIFIED
    passages_weak = [_make_passage("Random Blog", "Rumours say Pushpa 3 might target 2027.", recent_date, 0.40)]
    nli_weak = [NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.72)]
    assert generate_verdict(claim, nli_weak, passages_weak).verdict == VerdictLabel.UNVERIFIED

    print("[PASS] Step 4: Verdict Engine passed all 4 outcomes (VERIFIED, FALSE, MISLEADING, UNVERIFIED).")


def test_explanation_and_e2e_offline() -> None:
    """Structured local report generation across verdicts and no-evidence fast path."""
    claim = ClaimResult(
        submitted_claim="Pushpa 3 releasing on Christmas 2027",
        core_claim="Pushpa 3 will release on Christmas 2027.",
        category=ClaimCategory.RELEASE_UPDATE,
        entities=ExtractedEntities(movie="Pushpa 3", date="Christmas 2027"),
    )
    no_ev = generate_explanation(claim, generate_verdict(claim, [], []), [], [])
    assert "UNVERIFIED" in no_ev and "No credible" in no_ev

    recent_date = date.today().isoformat()
    passages = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 arrives on Christmas 2027.", recent_date, 0.90),
        _make_passage("Film Companion", "Producers officially confirmed Pushpa 3 for Christmas 2027.", recent_date, 0.95),
    ]
    nli_results = verify_claim(claim.core_claim, passages, movie_name="Pushpa 3")
    verdict = generate_verdict(claim, nli_results, passages)
    explanation = generate_explanation(claim, verdict, passages, nli_results)

    assert verdict.verdict == VerdictLabel.VERIFIED
    assert "`VERIFIED`" in explanation
    assert "Bollywood Hungama" in explanation or "Film Companion" in explanation

    false_passages = [_make_passage("Film Companion", "Studio denied Pushpa 3 release reports.", recent_date, 0.95)]
    false_nli = verify_claim(claim.core_claim, false_passages, movie_name="Pushpa 3")
    false_verdict = generate_verdict(claim, false_nli, false_passages)
    false_exp = generate_explanation(claim, false_verdict, false_passages, false_nli)
    assert false_verdict.verdict == VerdictLabel.FALSE and "Film Companion" in false_exp

    print("[PASS] Steps 5 & 6 offline tests passed.")


def test_security_and_extensions_offline() -> None:
    """Regression checks for SSRF guard, evergreen box-office milestone, comparisons, and follow-up fallback."""
    for unsafe_url in ("http://127.0.0.1:8000/api/history", "http://localhost:3000", "http://169.254.169.254/latest"):
        try:
            extract_claim(unsafe_url, InputType.URL)
            raise AssertionError(f"Expected SSRF guard to reject {unsafe_url}")
        except ValueError:
            pass

    old_date = (date.today() - timedelta(days=500)).isoformat()
    evergreen_claim = ClaimResult(
        submitted_claim="Kalki 2898 AD crossed 1000 crore worldwide at the box office",
        core_claim="Kalki 2898 AD crossed 1000 crore worldwide.",
        category=ClaimCategory.BOX_OFFICE,
        entities=ExtractedEntities(movie="Kalki 2898 AD", amount="1000 crore worldwide"),
    )
    evergreen_passages = [
        _make_passage("Bollywood Hungama", "Kalki 2898 AD officially crossed 1000 crore worldwide.", old_date, 0.90),
        _make_passage("Sacnilk", "Kalki 2898 AD earned over 1042 crore worldwide gross.", old_date, 0.90),
    ]
    evergreen_nli = verify_claim(evergreen_claim.core_claim, evergreen_passages, movie_name="Kalki 2898 AD")
    evergreen_verdict = generate_verdict(evergreen_claim, evergreen_nli, evergreen_passages)
    assert evergreen_verdict.verdict == VerdictLabel.VERIFIED

    comparisons = build_claim_comparisons(evergreen_claim, evergreen_verdict, evergreen_passages, evergreen_nli)
    assert len(comparisons) >= 1 and comparisons[0].status.value == "match"

    with patch("app.services.evidence_retriever._get_embedding_model", return_value=None):
        picked = select_relevant_chunks(
            "Kalki 2898 AD crossed 1000 crore worldwide",
            [
                "Actor Prabhas attended an unrelated award ceremony last summer.",
                "Kalki 2898 AD crossed 1000 crore worldwide box office gross according to Sacnilk.",
                "The film features futuristic visual effects shot in Hyderabad.",
                "Worldwide collections reached 1042 crore across Hindi and Telugu versions.",
            ],
            max_chunks=2,
        )
        assert len(picked) == 2 and "1000 crore" in picked[0]

    with patch("app.services.explanation_gen.answer_followup_with_slm", return_value=""):
        followup = answer_followup_question(
            FollowUpRequest(
                claim=evergreen_claim.submitted_claim,
                core_claim=evergreen_claim.core_claim,
                verdict=VerdictLabel.VERIFIED,
                explanation="Confirmed by trade trackers.",
                evidence=[
                    EvidenceItem(
                        source_name="Sacnilk",
                        url="https://sacnilk.com/test",
                        title="Kalki crosses 1000 Cr",
                        published_date=old_date,
                        stance=StanceLabel.SUPPORTS,
                        snippet="Kalki 2898 AD earned 1042 crore worldwide.",
                        credibility_score=0.9,
                    )
                ],
                question="What figure did Sacnilk report?",
            )
        )
        assert "Sacnilk" in followup.answer and "1042" in followup.answer

    print("[PASS] Security, evergreen verdict, comparisons, and follow-up offline tests passed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CineVerify local SLM pipeline checks.")
    parser.add_argument("--live", action="store_true", help="Include live Ollama checks.")
    args = parser.parse_args()

    test_claim_extractor_offline()
    test_nli_verifier_offline()
    test_verdict_engine_all_four_outcomes()
    test_explanation_and_e2e_offline()
    test_security_and_extensions_offline()
    if args.live:
        ext = extract_claim("Pushpa 3 releasing on Christmas 2027", InputType.TEXT)
        assert "Pushpa 3" in ext.core_claim
        print("[PASS] Live Ollama extraction guardrail check passed.")


if __name__ == "__main__":
    main()
