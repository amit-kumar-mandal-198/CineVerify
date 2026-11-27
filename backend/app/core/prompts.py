"""LLM prompt templates for claim extraction and grounded explanation (owned by Member 1)."""

CLAIM_EXTRACTION_PROMPT = """You are an Indian cinema news analyst.
Extract structured details from the submitted claim or headline.

Return valid JSON matching this schema:
{{
  "core_claim": "one concise factual assertion",
  "category": "movie_announcement | casting | release_update | box_office",
  "entities": {{
    "movie": "string or null",
    "person": "string or null",
    "production_house": "string or null",
    "date": "string or null",
    "platform": "string or null",
    "amount": "string or null"
  }}
}}

Input text:
{input_text}
"""

EXPLANATION_GENERATION_PROMPT = """You are an explainable fact-checking assistant for Indian cinema news.
Write a clear 3-5 sentence explanation justifying the final verdict.

STRICT RULES:
- ONLY cite facts, dates, and source names present in the provided evidence.
- Do NOT invent external facts or rely on unstated assumptions.
- If verdict is UNVERIFIED, explain clearly what credible evidence is missing or inconclusive.
- If verdict is MISLEADING, explain the date mismatch, exaggeration, or missing context.

Claim: {claim}
Verdict: {verdict}
Evidence:
{evidence_summary}
"""
