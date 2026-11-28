"""
cineverify_engine.py - Core CineVerify Python Integration Module
Import and call this in any backend service, script, or framework.
"""

import urllib.request
import json
from typing import Dict, Any, Optional

OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "cineverify"

class CineVerifyEngine:
    def __init__(self, model_name: str = MODEL_NAME, api_url: str = OLLAMA_API_URL):
        self.model_name = model_name
        self.api_url = api_url

    def verify(self, text: str, max_tokens: int = 400, temperature: float = 0.1) -> Dict[str, Any]:
        """
        Takes raw cinema news/headline and returns structured verification JSON.
        """
        payload = {
            "model": self.model_name,
            "prompt": text,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "stop": ["<|im_end|>", "<|endoftext|>"]
            }
        }

        req = urllib.request.Request(
            self.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        full_text = ""
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                for line in response:
                    if line:
                        chunk = json.loads(line.decode("utf-8"))
                        token = chunk.get("response", "")
                        full_text += token
                        if chunk.get("done", False):
                            break
        except Exception as e:
            return {
                "error": True,
                "message": f"Could not connect to Ollama service: {str(e)}"
            }

        full_text = full_text.strip()
        
        # Parse JSON
        try:
            # Handle potential markdown fence wrapping
            clean = full_text
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()
            
            return json.loads(clean)
        except json.JSONDecodeError:
            return {
                "raw_output": full_text,
                "error": False
            }

# Convenient standalone function
engine = CineVerifyEngine()

def verify_claim(headline: str) -> Dict[str, Any]:
    return engine.verify(headline)

if __name__ == "__main__":
    test_query = "Deepika Padukone joins Spirit opposite Prabhas"
    print(f"Testing CineVerifyEngine on: '{test_query}'...")
    res = verify_claim(test_query)
    print(json.dumps(res, indent=2, ensure_ascii=False))
