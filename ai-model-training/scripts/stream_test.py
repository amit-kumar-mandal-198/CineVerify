import urllib.request
import json
import sys

payload = {
    "model": "cineverify",
    "prompt": "Deepika Padukone joins Spirit opposite Prabhas",
    "stream": True,
    "options": {"temperature": 0.1, "num_predict": 350, "stop": ["<|im_end|>", "<|endoftext|>"]}
}

req = urllib.request.Request(
    "http://127.0.0.1:11434/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        print("Connected to stream. Receiving tokens:")
        for line in response:
            if line:
                chunk = json.loads(line.decode("utf-8"))
                token = chunk.get("response", "")
                sys.stdout.write(token)
                sys.stdout.flush()
                if chunk.get("done", False):
                    break
        print("\n[STREAM COMPLETE]")
except Exception as e:
    print(f"Error: {e}")
