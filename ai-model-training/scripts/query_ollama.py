import urllib.request
import json
import sys

headline = sys.argv[1] if len(sys.argv) > 1 else "Deepika Padukone joins Spirit opposite Prabhas"

payload = {
    "model": "cineverify",
    "prompt": headline,
    "stream": False,
    "options": {
        "temperature": 0.1
    }
}

req = urllib.request.Request(
    "http://127.0.0.1:11434/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=120) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        raw_response = res_data.get("response", "").strip()
        print("\n=== Model Raw Output ===")
        print(raw_response)
        
        try:
            parsed = json.loads(raw_response)
            print("\n=== Parsed JSON Validation ===")
            print(json.dumps(parsed, indent=2))
            print("\n[SUCCESS] Custom model generated 100% valid JSON!")
        except Exception as e:
            print(f"\n[INFO] Output parsed as text: {raw_response}")
except Exception as e:
    print(f"Error querying Ollama API: {e}")
