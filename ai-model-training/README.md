# 🎬 CineVerify-Core-3B-v2 — Fact-Checking & Mathematical Verification SLM

> **Domain-specialized Small Language Model (SLM) for Indian Cinema Fact-Checking with Built-In Mathematical Verification Breakdown**

`CineVerify-Core-3B-v2` fine-tunes **`Qwen/Qwen2.5-3B-Instruct`** using **Unsloth QLoRA (4-bit)** to extract claims and entities, then computes an explicit, transparent **weighted mathematical confidence score** and step-by-step calculation.

---

## 📐 Mathematical Verification Engine

The verification credibility score (\(V_{score}\)) is computed as:

$$V_{score} = \left(0.40 \times S_{src}\right) + \left(0.35 \times S_{ent}\right) + \left(0.25 \times S_{time}\right) - P_{dispute}$$

- **\(S_{src}\) (Source Authority, 40%):** 0.9–1.0 (Official makers/filmmaker handle), 0.7–0.85 (Tier-1 trade portals), 0.25–0.45 (Fan clubs/gossip handles).
- **\(S_{ent}\) (Entity Feasibility, 35%):** Are named cast and production houses under active contract?
- **\(S_{time}\) (Timeline Feasibility, 25%):** Does production cycle and release slot align?
- **\(P_{dispute}\) (Dispute Penalty):** Deducts 0.10 to 0.40 for active denials or direct release date clashes.

---

## 🎯 Target Output Schema (Contract v3)

```json
{
  "text_refinement": {
    "cleaned_text": "Official: Deepika Padukone joins Spirit opposite Prabhas.",
    "simplified_claim": "Deepika Padukone will co-star with Prabhas in Spirit.",
    "typos_fixed": ["'Deepka' -> 'Deepika Padukone'", "'opp' -> 'opposite'"]
  },
  "core_claim": "Deepika Padukone has been officially cast opposite Prabhas in Spirit.",
  "category": "casting",
  "entities": {
    "movie": "Spirit",
    "person": "Deepika Padukone, Prabhas",
    "production_house": "T-Series",
    "date": null,
    "platform": null,
    "amount": null
  },
  "verification": {
    "verdict": "CONFIRMED_OFFICIAL",
    "confidence_score": 0.93,
    "calculation": {
      "source_authority": 0.95,
      "entity_feasibility": 0.92,
      "timeline_feasibility": 0.90,
      "dispute_penalty": 0.00,
      "formula": "Score = (0.40 * 0.95) + (0.35 * 0.92) + (0.25 * 0.90) - 0.00",
      "step_by_step": "0.380 + 0.322 + 0.225 - 0.00 = 0.927 (93%)"
    },
    "verdict_reasoning": "Official casting confirmation issued by production house."
  },
  "descriptive_answer": "The production team has officially welcomed Deepika Padukone to the cast of Spirit alongside Prabhas. The casting is verified by official production announcements, giving it a top-tier credibility score."
}
```

---

## 📁 Repository Structure

```
ai-model-training/
├── data/
│   ├── cineverify_train_v2.jsonl  # 460 ChatML samples with math verification
│   ├── cineverify_val_v2.jsonl    # 52 validation samples
│   ├── cineverify_train.jsonl     # v1 training dataset (295 samples)
│   └── cineverify_val.jsonl       # v1 validation dataset (33 samples)
├── notebooks/
│   └── CineVerify_Training_Colab.ipynb
├── scripts/
│   ├── generate_dataset.py        # v2 dataset generator & schema validator
│   └── test_inference.py          # Local inference & math contract tester
└── README.md
```

---

## ⚡ Instant Local Inference (Running 100% on Your Laptop GPU)

Your fine-tuned model is actively registered and running in **Ollama** on your laptop!

### Test from Terminal:
```bash
python scripts/verify_claim.py "Deepika Padukone joins Spirit opposite Prabhas"
```

Or query any headline:
```bash
python scripts/verify_claim.py "Pushpa 2: The Rule locks worldwide release on December 5, 2024"
```

The model outputs guaranteed JSON with the exact 4-factor mathematical calculation!

1. Open your active Google Colab notebook tab.
2. In the Files panel on the left, upload [`cineverify_train_v2.jsonl`](file:///c:/Users/asus/Downloads/Ai/ai-model-training/data/cineverify_train_v2.jsonl).
3. In **Cell 4**, update the filename:
   ```python
   train_file = "cineverify_train_v2.jsonl"
   ```
4. Run **Cell 4** (Format dataset) and **Cell 5** (`trainer.train()`).
5. Run **Cell 7** to export the quantized model:
   ```python
   model.save_pretrained_gguf("CineVerify-Core-3B-v2-GGUF", tokenizer, quantization_method="q4_k_m")
   ```
6. Download the resulting `.gguf` file to your PC!
