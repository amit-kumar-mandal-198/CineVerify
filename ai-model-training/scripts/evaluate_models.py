#!/usr/bin/env python3
"""
evaluate_models.py - Phase 6 Benchmark & Evaluation Suite
Tests the integrated local CineVerify backend against representative live cinema claims
AND measures Ollama `cineverify` SLM performance on a disjoint sample slice from `cinema_validation_v5.json`.
"""

import json
import time
import urllib.request
from pathlib import Path

API_EVAL_CASES = [
    {
        "claim": "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
        "expected_verdict": "VERIFIED",
        "expected_category": "box_office",
        "must_not_contain": ["Toxic", "A Fairy Tale", "Yash", "UNVERIFIED"],
        "must_contain_entity": "Kalki 2898 AD",
    },
    {
        "claim": "has kalki crossed 1000cr worldwide?? older news said only 900 cr",
        "expected_verdict": "VERIFIED",
        "expected_category": "box_office",
        "must_not_contain": ["A Fairy Tale", "Toxic", "Yash"],
        "must_contain_entity": "Kalki 2898 AD",
    },
    {
        "claim": "did kalki cross 1000 crore on day 10?",
        "expected_verdict": "FALSE",
        "expected_category": "box_office",
        "must_not_contain": ["Kalki 2: Part 1"],
        "must_contain_entity": "Kalki",
    },
    {
        "claim": "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
        "expected_verdict": "VERIFIED",
        "expected_category": "movie_announcement",
        "must_not_contain": ["Devara", "Shah Rukh Khan", "Kantara"],
        "must_contain_entity": "Mahesh Babu",
    },
    {
        "claim": "Shah Rukh Khan and Sujoy Ghosh announce action thriller King",
        "expected_verdict": "VERIFIED",
        "expected_category": "movie_announcement",
        "must_not_contain": ["KANTARA", "DE MAAI", "Hollywood Action Thriller"],
        "must_contain_entity": "King",
    },
    {
        "claim": "Pushpa 3 releasing on Christmas 2027",
        "expected_verdict": "UNVERIFIED",
        "expected_category": "release_update",
        "must_not_contain": ["Pushpa 2", "June 27, 2028", "Kendriya Vidyalaya"],
        "must_contain_entity": "Pushpa 3",
    },
    {
        "claim": "Deepika Padukone joins Spirit opposite Prabhas",
        "expected_verdict": "FALSE",
        "expected_category": "casting",
        "must_not_contain": [],
        "must_contain_entity": "Spirit",
    },
]


def eval_live_api():
    print("\n=== BENCHMARK PART 1: INTEGRATED BACKEND END-TO-END (/api/verify) ===")
    passed = 0
    latencies = []
    hallucinations = 0

    for idx, case in enumerate(API_EVAL_CASES, start=1):
        started = time.perf_counter()
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/verify",
            data=json.dumps({"claim": case["claim"], "type": "text"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        latencies.append(elapsed_ms)

        verdict = data["verdict"]
        core_claim = data["core_claim"]
        explanation = data["explanation"]
        sources = [e["source_name"] for e in data["evidence"]]
        combined_out = f"{verdict} {core_claim} {explanation} {' '.join(sources)}"

        bad_hits = [b for b in case["must_not_contain"] if b.lower() in combined_out.lower()]
        if bad_hits:
            hallucinations += 1

        verdict_ok = verdict == case["expected_verdict"]
        entity_ok = case["must_contain_entity"].lower() in core_claim.lower()
        consistency_ok = f"**Final Verdict:** `{verdict}`" in explanation
        source_ok = all(s != "News" for s in sources) if sources else True

        row_ok = verdict_ok and entity_ok and consistency_ok and not bad_hits and source_ok
        if row_ok:
            passed += 1

        status_tag = "PASS" if row_ok else "CHECK"
        print(
            f"[{status_tag}] #{idx}: '{case['claim'][:48]}...' | "
            f"Verdict={verdict} (exp={case['expected_verdict']}) | Conf={int(data['confidence']*100)}% | "
            f"Sources={sources[:3]} | {elapsed_ms}ms | BadHits={bad_hits}"
        )

    avg_ms = round(sum(latencies) / len(latencies)) if latencies else 0
    print(
        f"\nSummary (Live Integrated Backend): {passed}/{len(API_EVAL_CASES)} passed | "
        f"Hallucinations/Drift: {hallucinations} | Avg Latency: {avg_ms}ms"
    )
    return passed, len(API_EVAL_CASES), hallucinations, avg_ms


def eval_validation_holdout():
    print("\n=== BENCHMARK PART 2: DISJOINT HOLDOUT SAMPLES (cinema_validation_v5.json) ===")
    val_path = Path(__file__).resolve().parents[1] / "data" / "cinema_validation_v5.json"
    items = json.loads(val_path.read_text(encoding="utf-8"))[:12]

    correct = 0
    valid_json = 0
    for idx, entry in enumerate(items, start=1):
        msgs = entry["messages"]
        sys_msg = msgs[0]["content"]
        usr_msg = msgs[1]["content"]
        expected = json.loads(msgs[2]["content"])

        payload = {
            "model": "cineverify",
            "system": sys_msg,
            "prompt": usr_msg + "\n\nRespond ONLY in valid JSON with key 'verdict' in {TRUE, FALSE, MISLEADING, OUTDATED, PARTIALLY_TRUE, UNVERIFIED}.",
            "stream": False,
            "options": {"temperature": 0.05, "num_predict": 450, "stop": ["<|im_end|>", "<|endoftext|>"]},
        }
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = json.loads(resp.read().decode("utf-8"))["response"].strip()

        clean = raw.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        pred_v = "PARSE_ERR"
        try:
            parsed = json.loads(clean)
            valid_json += 1
            pred_v = str(parsed.get("verdict") or "").upper()
        except Exception:
            pass

        exp_v = expected["verdict"].upper()
        match = pred_v == exp_v or (exp_v == "OUTDATED" and pred_v == "MISLEADING") or (exp_v == "PARTIALLY_TRUE" and pred_v == "MISLEADING")
        if match:
            correct += 1
        print(f"  Val #{idx:02d}: expected={exp_v:14s} | predicted={pred_v:14s} | {'MATCH' if match else 'DIFF'}")

    print(f"\nHoldout Summary: Valid JSON={valid_json}/{len(items)} | Verdict Alignment={correct}/{len(items)}")


if __name__ == "__main__":
    eval_live_api()
    eval_validation_holdout()
