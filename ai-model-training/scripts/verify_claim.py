#!/usr/bin/env python3
"""
verify_claim.py - CineVerify CLI Fact-Checking Tool
Sends raw noisy entertainment news to your local custom model on Ollama
and returns clean text refinement, entities, mathematical calculation, and descriptive answers.
"""

import urllib.request
import json
import sys

def verify_headline(headline: str):
    payload = {
        "model": "cineverify",
        "prompt": headline,
        "stream": True,
        "options": {
            "temperature": 0.1,
            "num_predict": 450,
            "stop": ["<|im_end|>", "<|endoftext|>"]
        }
    }

    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    full_text = ""
    with urllib.request.urlopen(req, timeout=30) as response:
        for line in response:
            if line:
                chunk = json.loads(line.decode("utf-8"))
                token = chunk.get("response", "")
                full_text += token
                if chunk.get("done", False):
                    break

    full_text = full_text.strip()
    try:
        parsed = json.loads(full_text)
        return parsed
    except json.JSONDecodeError:
        return {"raw_output": full_text}

def print_pretty_report(data: dict):
    if "raw_output" in data:
        print("\n--- Model Output ---")
        print(data["raw_output"])
        return

    print("\n" + "="*60)
    print("🎬 CINEVERIFY FACT-CHECKING & REFINEMENT REPORT")
    print("="*60)
    
    # 1. Text Refinement
    refinement = data.get("text_refinement", {})
    if refinement:
        print("\n🧹 [TEXT REFINEMENT & SIMPLIFICATION]")
        print(f"  • Cleaned Text     : {refinement.get('cleaned_text', 'N/A')}")
        print(f"  • Simplified Claim : {refinement.get('simplified_claim', 'N/A')}")
        typos = refinement.get("typos_fixed", [])
        if typos:
            print(f"  • Corrections Made : {', '.join(typos)}")

    # 2. Extracted Claim & Category
    print("\n📌 [EXTRACTED CLAIM]")
    print(f"  • Core Claim : {data.get('core_claim', 'N/A')}")
    print(f"  • Category   : {data.get('category', 'N/A').upper()}")
    
    # Entities
    entities = data.get("entities", {})
    active_entities = {k: v for k, v in entities.items() if v}
    if active_entities:
        print(f"  • Entities   : {active_entities}")

    # 3. Verification & Math Calculation
    verif = data.get("verification", {})
    if verif:
        print("\n⚖️ [MATHEMATICAL VERIFICATION BREAKDOWN]")
        verdict = verif.get("verdict", "N/A")
        score = verif.get("confidence_score", 0.0)
        print(f"  • Verdict           : {verdict}")
        print(f"  • Confidence Score  : {int(score * 100)}% ({score})")
        calc = verif.get("calculation", {})
        if calc:
            print(f"  • Formula           : {calc.get('formula')}")
            print(f"  • Calculation Step  : {calc.get('step_by_step')}")
        print(f"  • Verdict Reasoning : {verif.get('verdict_reasoning')}")

    # 4. Descriptive Answer
    descriptive = data.get("descriptive_answer")
    if descriptive:
        print("\n📖 [DESCRIPTIVE DETAILED ANSWER]")
        print(f"  {descriptive}")

    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    test_headline = sys.argv[1] if len(sys.argv) > 1 else "Deepika Padukone joins Spirit opposite Prabhas"
    print(f"\nProcessing: \"{test_headline}\" ...")
    result = verify_headline(test_headline)
    print_pretty_report(result)
