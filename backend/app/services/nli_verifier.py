"""Natural Language Inference (NLI) claim-evidence verification (owned by Member 1)."""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List

import numpy as np
from sentence_transformers import CrossEncoder

from app.core.models_config import NLI_MODEL_NAME
from app.schemas.evidence import EvidencePassage, StanceLabel
from app.schemas.verdict import NLIResult

_DEFAULT_ID_TO_STANCE: Dict[int, StanceLabel] = {
    0: StanceLabel.CONTRADICTS,
    1: StanceLabel.SUPPORTS,
    2: StanceLabel.NEUTRAL,
}


@lru_cache(maxsize=1)
def _get_nli_model() -> CrossEncoder:
    """Lazy-load and cache the NLI CrossEncoder model once per process."""
    return CrossEncoder(NLI_MODEL_NAME)


def _resolve_id_to_stance(model: object) -> Dict[int, StanceLabel]:
    """Read model.model.config.id2label dynamically to avoid hardcoded label-index assumptions."""
    inner_model = getattr(model, "model", None)
    config = getattr(inner_model, "config", None)
    id2label = getattr(config, "id2label", None)
    if not isinstance(id2label, dict) or not id2label:
        return dict(_DEFAULT_ID_TO_STANCE)

    mapping: Dict[int, StanceLabel] = {}
    for raw_idx, raw_label in id2label.items():
        idx = int(raw_idx)
        label = str(raw_label).strip().lower()
        if "entail" in label or "support" in label:
            mapping[idx] = StanceLabel.SUPPORTS
        elif "contradict" in label or "refut" in label:
            mapping[idx] = StanceLabel.CONTRADICTS
        elif "neutral" in label:
            mapping[idx] = StanceLabel.NEUTRAL

    if len(mapping) < 3:
        return dict(_DEFAULT_ID_TO_STANCE)
    return mapping


def _ensure_probabilities(scores: np.ndarray) -> np.ndarray:
    """Normalize a 2D array of logits/probabilities row-wise via softmax when needed."""
    matrix = np.atleast_2d(np.asarray(scores, dtype=np.float64))
    row_sums = matrix.sum(axis=1, keepdims=True)
    already_probs = np.all(matrix >= -1e-6) and np.all(matrix <= 1.0 + 1e-6) and np.allclose(row_sums, 1.0, atol=1e-3)
    if already_probs:
        return np.clip(matrix, 0.0, 1.0)

    shifted = matrix - np.max(matrix, axis=1, keepdims=True)
    exps = np.exp(shifted)
    return exps / np.sum(exps, axis=1, keepdims=True)


def verify_claim(core_claim: str, passages: List[EvidencePassage]) -> List[NLIResult]:
    """Classify each evidence passage as supports, contradicts, or neutral vs. core_claim."""
    if not passages or not (core_claim or "").strip():
        return []

    model = _get_nli_model()
    id_to_stance = _resolve_id_to_stance(model)

    # NLI expects (premise, hypothesis) = (evidence passage text, core claim).
    pairs = [(passage.text, core_claim) for passage in passages]
    raw_scores = model.predict(
        pairs,
        apply_softmax=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    probs = _ensure_probabilities(raw_scores)

    results: List[NLIResult] = []
    for idx, row in enumerate(probs):
        best_label_idx = int(np.argmax(row))
        stance = id_to_stance.get(best_label_idx, StanceLabel.NEUTRAL)
        confidence = float(np.clip(row[best_label_idx], 0.0, 1.0))
        results.append(
            NLIResult(
                passage_index=idx,
                stance=stance,
                confidence=round(confidence, 4),
            )
        )
    return results
