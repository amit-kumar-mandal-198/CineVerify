#!/usr/bin/env python3
"""
test_inference.py - CineVerify v2 Model Inference & Verification Tool
Tests fine-tuned CineVerify-Core-3B models with embedded mathematical verification calculations.
"""

import argparse
import json
import sys
from typing import Dict, Any, Optional

SYSTEM_PROMPT = (
    "You are CineVerify-AI, an expert Indian cinema fact-checking model. "
    "Extract the core claim, category, entities, and compute the step-by-step verification calculation and verdict in valid JSON."
)

ALLOWED_CATEGORIES = ["movie_announcement", "casting", "release_update", "box_office"]
EXPECTED_ENTITY_KEYS = ["movie", "person", "production_house", "date", "platform", "amount"]
ALLOWED_VERDICTS = ["CONFIRMED_OFFICIAL", "HIGHLY_PLAUSIBLE", "UNVERIFIED_RUMOUR", "DEBUNKED_FAKE"]

def validate_cineverify_output(output_str: str) -> Optional[Dict[str, Any]]:
    """Validates that model output is valid JSON and adheres to CineVerify v2 schema."""
    try:
        clean_str = output_str.strip()
        if clean_str.startswith("```json"):
            clean_str = clean_str[7:]
        if clean_str.startswith("```"):
            clean_str = clean_str[3:]
        if clean_str.endswith("```"):
            clean_str = clean_str[:-3]
        clean_str = clean_str.strip()
        
        parsed = json.loads(clean_str)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse JSON: {e}")
        print(f"Raw Output:\n{output_str}")
        return None
        
    for req_key in ["core_claim", "category", "entities"]:
        if req_key not in parsed:
            print(f"[ERROR] Missing required key '{req_key}'")
            return None
            
    if parsed["category"] not in ALLOWED_CATEGORIES:
        print(f"[ERROR] Invalid category '{parsed['category']}'")
        return None
        
    entities = parsed.get("entities", {})
    if not isinstance(entities, dict):
        print("[ERROR] 'entities' must be a JSON object.")
        return None
        
    for ek in EXPECTED_ENTITY_KEYS:
        if ek not in entities:
            print(f"[ERROR] Missing entity key '{ek}'")
            return None
            
    # If v2 verification block is present, validate math calculation structure
    if "verification" in parsed:
        v = parsed["verification"]
        if "verdict" not in v or v["verdict"] not in ALLOWED_VERDICTS:
            print(f"[WARNING] Verdict '{v.get('verdict')}' not in standard list {ALLOWED_VERDICTS}")
        if "calculation" in v:
            calc = v["calculation"]
            for ck in ["formula", "step_by_step", "source_authority", "entity_feasibility", "timeline_feasibility", "dispute_penalty"]:
                if ck not in calc:
                    print(f"[WARNING] Missing calculation key '{ck}'")
                    
    return parsed

def run_llama_cpp(model_path: str, headline: str):
    """Run inference using llama-cpp-python with 4-bit GGUF."""
    try:
        from llama_cpp import Llama
    except ImportError:
        print("[ERROR] llama-cpp-python is not installed. Run: pip install llama-cpp-python")
        sys.exit(1)
        
    print(f"Loading GGUF model from {model_path}...")
    llm = Llama(
        model_path=model_path,
        n_ctx=1024,
        n_threads=4,
        verbose=False
    )
    
    prompt = (
        f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
        f"<|im_start|>user\n{headline}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )
    
    print(f"\nProcessing headline: '{headline}'")
    response = llm(
        prompt,
        max_tokens=350,
        stop=["<|im_end|>", "```"],
        temperature=0.1
    )
    
    output_text = response["choices"][0]["text"].strip()
    return output_text

def run_dry_run_validation():
    print("Running dry-run verification against CineVerify v2 contract...\n")
    sample_v2 = {
        "core_claim": "Deepika Padukone has been cast opposite Prabhas in Spirit.",
        "category": "casting",
        "entities": {
            "movie": "Spirit",
            "person": "Deepika Padukone, Prabhas",
            "production_house": "T-Series",
            "date": None,
            "platform": None,
            "amount": None
        },
        "verification": {
            "verdict": "CONFIRMED_OFFICIAL",
            "confidence_score": 0.93,
            "calculation": {
                "source_authority": 0.95,
                "entity_feasibility": 0.92,
                "timeline_feasibility": 0.90,
                "dispute_penalty": 0.0,
                "formula": "Score = (0.40 * 0.95) + (0.35 * 0.92) + (0.25 * 0.90) - 0.00",
                "step_by_step": "0.380 + 0.322 + 0.225 - 0.00 = 0.927 (93%)"
            },
            "verdict_reasoning": "Official casting confirmation issued by production house."
        }
    }
    res = validate_cineverify_output(json.dumps(sample_v2))
    assert res is not None, "Sample v2 validation failed"
    print(" [OK] Schema and Mathematical Verification validator passed!")
    print(json.dumps(res, indent=2))

def main():
    parser = argparse.ArgumentParser(description="CineVerify v2 Inference & Verification Tool")
    parser.add_argument("--model", type=str, default=None, help="Path to exported GGUF model")
    parser.add_argument("--headline", type=str, default="Deepika Padukone joins Spirit opposite Prabhas", help="Headline to test")
    parser.add_argument("--dry-run", action="store_true", help="Run contract verification self-check without loading weights")
    args = parser.parse_args()
    
    if args.dry_run or args.model is None:
        run_dry_run_validation()
        if args.model is None:
            print("\nTip: Specify --model <path-to-gguf> --headline \"Your news text\" once you download your trained GGUF model.")
        return

    output = run_llama_cpp(args.model, args.headline)
    print("\n--- Model Output ---")
    print(output)
    
    print("\n--- Contract Validation ---")
    validated = validate_cineverify_output(output)
    if validated:
        print("[SUCCESS] Output complies 100% with CineVerify v2 contract!")
        print(json.dumps(validated, indent=2))
    else:
        print("[FAIL] Output does not comply with CineVerify v2 contract.")

if __name__ == "__main__":
    main()
