# CineVerify AI — Evaluation Dataset

This directory holds the manually curated Indian cinema verification dataset used to benchmark retrieval recall, verdict accuracy, and misleading/unverified handling.

## Rules for Contributors
1. **Never treat AI output as ground truth.** Every `ground_truth_verdict` must be manually verified by reading primary sources.
2. **Include balanced coverage** across all 4 categories (`movie_announcement`, `casting`, `release_update`, `box_office`) and all 4 verdicts (`VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`).
3. **Record dates carefully** (`claim_date` vs `evidence_date`) so temporal/outdated-news detection can be evaluated accurately.
4. Keep demo examples separate or clearly tagged once validated against real sources.

## Files
- `claims.template.json` — Empty schema template showing the required fields for each record.
- `claims.json` — (To be created by Dataset Lead) Manually validated labelled claims.
- `evaluation_results.json` — (Generated during testing) Benchmark outputs vs ground truth.
