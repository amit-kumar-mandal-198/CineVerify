"""
api.py - CineVerify REST API Service
FastAPI backend service exposing /verify endpoint with CORS support.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from cineverify_engine import CineVerifyEngine

app = FastAPI(
    title="CineVerify AI Fact-Checking & Verification Engine",
    version="1.0.0",
    description="Custom SLM API for Indian Cinema Claim Extraction & Mathematical Verification"
)

# Enable CORS for React/Next.js/HTML frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = CineVerifyEngine()

class VerifyRequest(BaseModel):
    headline: str = Field(..., description="Raw Indian cinema headline, tweet, or rumour to verify")
    max_tokens: Optional[int] = Field(400, description="Max generation tokens")

@app.get("/")
def health_check():
    return {
        "status": "online",
        "model": "cineverify",
        "service": "CineVerify AI Verification API"
    }

@app.post("/verify")
def verify_claim(req: VerifyRequest):
    if not req.headline or not req.headline.strip():
        raise HTTPException(status_code=400, detail="Headline cannot be empty.")
    
    result = engine.verify(req.headline.strip(), max_tokens=req.max_tokens)
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    
    return result

if __name__ == "__main__":
    import uvicorn
    print("Starting CineVerify API on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
