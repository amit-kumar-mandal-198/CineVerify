"""Standalone tests for the CineVerify AI/ML pipeline (Steps 2-6 of docs/ai-tasks.md)."""

from __future__ import annotations

import argparse
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

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


class _FakeCrossEncoder:
    """Deterministic mock CrossEncoder verifying id2label resolution and softmax scoring."""

    def __init__(self) -> None:
        self.model = SimpleNamespace(
            config=SimpleNamespace(id2label={0: "contradiction", 1: "entailment", 2: "neutral"})
        )

    def predict(self, pairs, **_kwargs):
        logits = []
        for premise, _ in pairs:
            lowered = premise.lower()
            if "denied" in lowered or "not releasing" in lowered:
                logits.append([4.0, -2.0, -1.0])  # contradiction
            elif "confirmed" in lowered or "officially" in lowered:
                logits.append([-2.0, 4.0, -1.0])  # entailment
            else:
                logits.append([-1.0, -1.0, 3.5])  # neutral
        return np.array(logits, dtype=np.float64)


def test_claim_extractor_offline() -> None:
    """Step 2 offline check: URL extraction, JSON parsing, empty input guard, and fallback."""
    try:
        extract_claim("   ", InputType.TEXT)
        raise AssertionError("Expected ValueError on empty claim input")
    except ValueError:
        pass

    with patch("app.services.claim_extractor.has_valid_gemini_key", return_value=False):
        res_box = extract_claim("Kalki 2898 AD crosses 1000 crore worldwide", InputType.TEXT)
        assert res_box.category == ClaimCategory.BOX_OFFICE
        assert res_box.submitted_claim == "Kalki 2898 AD crosses 1000 crore worldwide"

    mock_json = (
        '{"core_claim": "Deepika Padukone joined Spirit opposite Prabhas.", '
        '"category": "casting", '
        '"entities": {"movie": "Spirit", "person": "Deepika Padukone", '
        '"production_house": null, "date": null, "platform": null, "amount": null}}'
    )
    fake_client = SimpleNamespace(
        models=SimpleNamespace(generate_content=lambda **_kw: SimpleNamespace(text=mock_json))
    )
    with (
        patch("app.services.claim_extractor.has_valid_gemini_key", return_value=True),
        patch("app.services.claim_extractor.create_gemini_client", return_value=fake_client),
    ):
        res_cast = extract_claim("Deepika Padukone joins Spirit opposite Prabhas", InputType.TEXT)
        assert res_cast.category == ClaimCategory.CASTING
        assert res_cast.entities.movie == "Spirit"
        assert res_cast.entities.person == "Deepika Padukone"

    with (
        patch("app.services.claim_extractor.trafilatura.fetch_url", return_value="<html></html>"),
        patch("app.services.claim_extractor.trafilatura.extract", return_value="Pushpa 3 releasing on Christmas 2027."),
        patch("app.services.claim_extractor.trafilatura.extract_metadata", return_value=SimpleNamespace(title="Release News")),
        patch("app.services.claim_extractor.has_valid_gemini_key", return_value=False),
    ):
        res_url = extract_claim("https://example.com/pushpa3", InputType.URL)
        assert res_url.submitted_claim == "https://example.com/pushpa3"
        assert res_url.category == ClaimCategory.RELEASE_UPDATE

    print("[PASS] Step 2 offline tests passed.")


def test_nli_verifier_offline() -> None:
    """Step 3 offline check: empty guard, dynamic id2label mapping, and 3 stance classes."""
    assert verify_claim("Some claim", []) == []

    passages = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 releases in 2027.", "2026-11-20", 0.90),
        _make_passage("Film Companion", "Studio denied reports of Pushpa 3 releasing in 2027.", "2026-11-21", 0.95),
        _make_passage("Indian Express", "Allu Arjun attended an award function in Mumbai.", "2026-11-22", 0.85),
    ]
    with patch("app.services.nli_verifier._get_nli_model", return_value=_FakeCrossEncoder()):
        results = verify_claim("Pushpa 3 releases on Christmas 2027.", passages)

    assert len(results) == 3
    assert results[0].stance == StanceLabel.SUPPORTS and results[0].confidence > 0.9
    assert results[1].stance == StanceLabel.CONTRADICTS and results[1].confidence > 0.9
    assert results[2].stance == StanceLabel.NEUTRAL and results[2].confidence > 0.9
    print("[PASS] Step 3 offline tests passed.")


def test_verdict_engine_all_four_outcomes() -> None:
    """Step 4 standalone test: synthetic NLI + EvidencePassage inputs for all 4 verdicts."""
    recent_date = date.today().isoformat()
    old_date = (date.today() - timedelta(days=365)).isoformat()

    claim = ClaimResult(
        submitted_claim="Pushpa 3 releasing on Christmas 2027",
        core_claim="Pushpa 3 will release on Christmas 2027.",
        category=ClaimCategory.RELEASE_UPDATE,
        entities=ExtractedEntities(movie="Pushpa 3", date="Christmas 2027"),
    )

    # 1. VERIFIED: 2+ strong credible supporting passages
    passages_verified = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 arrives on Christmas 2027.", recent_date, 0.90),
        _make_passage("Indian Express", "Pushpa 3 is slated for a Christmas 2027 theatrical release.", recent_date, 0.85),
    ]
    nli_verified = [
        NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.92),
        NLIResult(passage_index=1, stance=StanceLabel.SUPPORTS, confidence=0.88),
    ]
    res_verified = generate_verdict(claim, nli_verified, passages_verified)
    assert res_verified.verdict == VerdictLabel.VERIFIED, f"Expected VERIFIED, got {res_verified}"

    # 2. FALSE: credible strong contradiction dominates
    passages_false = [
        _make_passage("Film Companion", "Mythri Movie Makers denied reports of Pushpa 3 releasing in 2027.", recent_date, 0.95),
    ]
    nli_false = [NLIResult(passage_index=0, stance=StanceLabel.CONTRADICTS, confidence=0.91)]
    res_false = generate_verdict(claim, nli_false, passages_false)
    assert res_false.verdict == VerdictLabel.FALSE, f"Expected FALSE, got {res_false}"

    # 3a. MISLEADING (conflicting credible reports)
    passages_conflict = [
        _make_passage("Bollywood Hungama", "Pushpa 3 locked for Christmas 2027.", recent_date, 0.90),
        _make_passage("Hindustan Times", "Studio clarified Pushpa 3 is not releasing in 2027.", recent_date, 0.85),
    ]
    nli_conflict = [
        NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.86),
        NLIResult(passage_index=1, stance=StanceLabel.CONTRADICTS, confidence=0.89),
    ]
    res_conflict = generate_verdict(claim, nli_conflict, passages_conflict)
    assert res_conflict.verdict == VerdictLabel.MISLEADING, f"Expected MISLEADING (conflict), got {res_conflict}"

    # 3b. MISLEADING (outdated supporting evidence > 180 days)
    outdated_claim = ClaimResult(
        submitted_claim="Actor X walks out of Project Y",
        core_claim="Actor X walked out of Project Y.",
        category=ClaimCategory.CASTING,
        entities=ExtractedEntities(person="Actor X", movie="Project Y"),
    )
    passages_outdated = [
        _make_passage("Pinkvilla", "Actor X exited Project Y amid scheduling issues.", old_date, 0.72),
    ]
    nli_outdated = [NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.90)]
    res_outdated = generate_verdict(outdated_claim, nli_outdated, passages_outdated)
    assert res_outdated.verdict == VerdictLabel.MISLEADING, f"Expected MISLEADING (outdated), got {res_outdated}"

    # 4. UNVERIFIED (no evidence and single low-credibility evidence)
    assert generate_verdict(claim, [], []).verdict == VerdictLabel.UNVERIFIED
    passages_weak = [_make_passage("Random Blog", "Rumours say Pushpa 3 might target 2027.", recent_date, 0.40)]
    nli_weak = [NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.72)]
    res_unverified = generate_verdict(claim, nli_weak, passages_weak)
    assert res_unverified.verdict == VerdictLabel.UNVERIFIED, f"Expected UNVERIFIED, got {res_unverified}"

    print("[PASS] Step 4: Verdict Engine passed all 4 outcomes (VERIFIED, FALSE, MISLEADING, UNVERIFIED).")


def test_explanation_and_e2e_offline() -> None:
    """Steps 5 & 6 offline check: all 4 explanation scenarios, no-evidence fast path, and mocked E2E."""
    claim = ClaimResult(
        submitted_claim="Pushpa 3 releasing on Christmas 2027",
        core_claim="Pushpa 3 will release on Christmas 2027.",
        category=ClaimCategory.RELEASE_UPDATE,
    )
    no_ev = generate_explanation(claim, generate_verdict(claim, [], []), [], [])
    assert "UNVERIFIED" in no_ev and "No credible" in no_ev

    recent_date = date.today().isoformat()
    passages = [
        _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 arrives on Christmas 2027.", recent_date, 0.90),
        _make_passage("Film Companion", "Producers officially confirmed Pushpa 3 for Christmas 2027.", recent_date, 0.95),
    ]
    with (
        patch("app.services.nli_verifier._get_nli_model", return_value=_FakeCrossEncoder()),
        patch("app.services.explanation_gen.has_valid_gemini_key", return_value=False),
    ):
        nli_results = verify_claim(claim.core_claim, passages)
        verdict = generate_verdict(claim, nli_results, passages)
        explanation = generate_explanation(claim, verdict, passages, nli_results)

        assert verdict.verdict == VerdictLabel.VERIFIED
        assert "Bollywood Hungama" in explanation or "Film Companion" in explanation

        # Also verify fallback explanation for FALSE, MISLEADING, and UNVERIFIED
        false_passages = [_make_passage("Film Companion", "Studio denied Pushpa 3 release reports.", recent_date, 0.95)]
        false_nli = verify_claim(claim.core_claim, false_passages)
        false_verdict = generate_verdict(claim, false_nli, false_passages)
        false_exp = generate_explanation(claim, false_verdict, false_passages, false_nli)
        assert false_verdict.verdict == VerdictLabel.FALSE and "Film Companion" in false_exp

        conflict_passages = [
            _make_passage("Bollywood Hungama", "Makers confirmed Pushpa 3 for 2027.", recent_date, 0.90),
            _make_passage("Hindustan Times", "Studio denied 2027 release rumours.", recent_date, 0.85),
        ]
        conflict_nli = verify_claim(claim.core_claim, conflict_passages)
        conflict_verdict = generate_verdict(claim, conflict_nli, conflict_passages)
        conflict_exp = generate_explanation(claim, conflict_verdict, conflict_passages, conflict_nli)
        assert conflict_verdict.verdict == VerdictLabel.MISLEADING and "MISLEADING" in conflict_exp

    print("[PASS] Steps 5 & 6 offline tests passed.")


def test_security_and_extensions_offline() -> None:
    """Regression checks for SSRF URL guard, evergreen box-office milestone, comparisons, and follow-up."""
    # 1. SSRF URL guard blocks localhost and private IP literals
    for unsafe_url in ("http://127.0.0.1:8000/api/history", "http://localhost:3000", "http://169.254.169.254/latest"):
        try:
            extract_claim(unsafe_url, InputType.URL)
            raise AssertionError(f"Expected SSRF guard to reject {unsafe_url}")
        except ValueError:
            pass

    # 2. Historical box-office milestone from >180 days ago stays VERIFIED (not MISLEADING)
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
    evergreen_nli = [
        NLIResult(passage_index=0, stance=StanceLabel.SUPPORTS, confidence=0.92),
        NLIResult(passage_index=1, stance=StanceLabel.SUPPORTS, confidence=0.89),
    ]
    evergreen_verdict = generate_verdict(evergreen_claim, evergreen_nli, evergreen_passages)
    assert evergreen_verdict.verdict == VerdictLabel.VERIFIED, f"Expected VERIFIED, got {evergreen_verdict}"

    # 3. Claim comparisons builder produces structured rows
    comparisons = build_claim_comparisons(evergreen_claim, evergreen_verdict, evergreen_passages, evergreen_nli)
    assert len(comparisons) >= 1 and comparisons[0].status.value == "match"

    # 4. Chunk relevance selector (single & batch) returns top chunks in original order
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

        batched = select_best_chunks_batch(
            "Kalki 2898 AD crossed 1000 crore worldwide",
            [
                ["Intro bio text.", "Kalki 2898 AD crossed 1000 crore worldwide gross."],
                ["Sacnilk reports 1042 crore worldwide.", "Unrelated trailer note."],
            ],
            max_chunks_per_article=1,
        )
        assert len(batched) == 2 and "1000 crore" in batched[0][0] and "1042 crore" in batched[1][0]

    # 5. Grounded follow-up Q&A fallback works cleanly offline
    with patch("app.services.explanation_gen.has_valid_gemini_key", return_value=False):
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

    print("[PASS] Security, evergreen verdict, chunk ranking, comparisons, and follow-up offline tests passed.")


def test_live_claim_extraction_and_nli() -> None:
    """Steps 2, 3, 5 & 6 live check (requires GEMINI_API_KEY and downloaded HuggingFace NLI model)."""
    # Step 2: 4 headline categories
    headlines = [
        ("Red Chillies announces Shah Rukh Khan's next action film", ClaimCategory.MOVIE_ANNOUNCEMENT),
        ("Deepika Padukone joins Spirit opposite Prabhas", ClaimCategory.CASTING),
        ("Pushpa 3 releasing on Christmas 2027", ClaimCategory.RELEASE_UPDATE),
        ("Kalki 2898 AD crosses 1000 crore worldwide", ClaimCategory.BOX_OFFICE),
    ]
    for headline, expected_cat in headlines:
        extracted = extract_claim(headline, InputType.TEXT)
        print(f"  [Step 2] {headline!r} -> category={extracted.category.value}, entities={extracted.entities.model_dump()}")
        assert extracted.submitted_claim == headline
        assert extracted.category == expected_cat, f"Expected {expected_cat}, got {extracted.category}"

    # Step 3: 3 NLI stance scenarios (supports, contradicts, neutral)
    recent_date = date.today().isoformat()
    nli_claim = "Deepika Padukone joins Spirit opposite Prabhas."
    nli_passages = [
        _make_passage("Bollywood Hungama", "Deepika Padukone has officially joined the cast of Spirit opposite Prabhas.", recent_date, 0.90),
        _make_passage("Film Companion", "Deepika Padukone is not part of Prabhas starrer Spirit and has not joined the film.", recent_date, 0.95),
        _make_passage("Indian Express", "The makers of Spirit announced that discussions are currently ongoing with multiple leading actresses.", recent_date, 0.85),
    ]
    nli_out = verify_claim(nli_claim, nli_passages)
    print("  [Step 3] NLI stances:", [(r.passage_index, r.stance.value, r.confidence) for r in nli_out])
    assert [r.stance for r in nli_out] == [StanceLabel.SUPPORTS, StanceLabel.CONTRADICTS, StanceLabel.NEUTRAL]

    # Step 5 & 6: Live E2E chain -> VERIFIED, FALSE, MISLEADING, UNVERIFIED
    claim = extract_claim("Deepika Padukone joins Spirit opposite Prabhas", InputType.TEXT)
    mock_verified = [
        _make_passage("Bollywood Hungama", "Deepika Padukone has officially joined the cast of Spirit opposite Prabhas.", recent_date, 0.90),
        _make_passage("Film Companion", "Trade sources confirm Deepika Padukone signed on to star opposite Prabhas in Spirit.", recent_date, 0.95),
    ]
    v_nli = verify_claim(claim.core_claim, mock_verified)
    v_verdict = generate_verdict(claim, v_nli, mock_verified)
    v_exp = generate_explanation(claim, v_verdict, mock_verified, v_nli)
    print(f"  [Step 6 VERIFIED] {v_verdict.verdict.value} ({v_verdict.confidence}) -> {v_exp}")
    assert v_verdict.verdict == VerdictLabel.VERIFIED and v_exp.strip()

    mock_false = [nli_passages[1]]
    f_nli = verify_claim(claim.core_claim, mock_false)
    f_verdict = generate_verdict(claim, f_nli, mock_false)
    f_exp = generate_explanation(claim, f_verdict, mock_false, f_nli)
    print(f"  [Step 6 FALSE] {f_verdict.verdict.value} ({f_verdict.confidence}) -> {f_exp}")
    assert f_verdict.verdict == VerdictLabel.FALSE and f_exp.strip()

    mock_conflict = [mock_verified[0], nli_passages[1]]
    m_nli = verify_claim(claim.core_claim, mock_conflict)
    m_verdict = generate_verdict(claim, m_nli, mock_conflict)
    m_exp = generate_explanation(claim, m_verdict, mock_conflict, m_nli)
    print(f"  [Step 6 MISLEADING] {m_verdict.verdict.value} ({m_verdict.confidence}) -> {m_exp}")
    assert m_verdict.verdict == VerdictLabel.MISLEADING and m_exp.strip()

    u_verdict = generate_verdict(claim, [], [])
    u_exp = generate_explanation(claim, u_verdict, [], [])
    print(f"  [Step 6 UNVERIFIED] {u_verdict.verdict.value} ({u_verdict.confidence}) -> {u_exp}")
    assert u_verdict.verdict == VerdictLabel.UNVERIFIED and u_exp.strip()

    print("[PASS] Live Steps 2, 3, 5 & 6 pipeline succeeded across all 4 verdicts.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CineVerify AI pipeline checks.")
    parser.add_argument("--live", action="store_true", help="Also run live Gemini + NLI model checks.")
    args = parser.parse_args()

    test_claim_extractor_offline()
    test_nli_verifier_offline()
    test_verdict_engine_all_four_outcomes()
    test_explanation_and_e2e_offline()
    test_security_and_extensions_offline()
    if args.live:
        test_live_claim_extraction_and_nli()
    else:
        print("Skipped --live checks (run with `--live` once GEMINI_API_KEY is set to test Gemini + NLI).")


if __name__ == "__main__":
    main()
