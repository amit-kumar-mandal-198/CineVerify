#!/usr/bin/env python3
"""
generate_dataset.py - CineVerify v3 Dataset Generator
Adds:
1. Text Refinement (typo correction, slang normalization, simplification)
2. Mathematical Verification Engine (formula + step-by-step arithmetic)
3. Rich Descriptive Answers at the end (contextual plain-English explanation)
"""

import json
import os
import random
from typing import Dict, Any, List, Tuple

SYSTEM_PROMPT = (
    "You are CineVerify-AI, an expert Indian cinema fact-checking model. "
    "Clean and refine noisy user text, extract core claims and entities, compute the step-by-step mathematical verification, "
    "and provide a detailed descriptive analysis in valid JSON."
)

CATEGORIES = ["movie_announcement", "casting", "release_update", "box_office"]

MOVIES = [
    ("Spirit", ["Spirt", "spirit", "Spiritt"]),
    ("Pushpa 2: The Rule", ["Pushpa 2", "pushpa2", "Pushpa The Rule", "Puspa 2"]),
    ("Kalki 2898 AD", ["Kalki", "kalki 2898", "Kalki2898AD", "Project K"]),
    ("Devara: Part 2", ["Devara 2", "devara part 2", "Devara Part2"]),
    ("Toxic: A Fairy Tale for Grown-ups", ["Toxic", "toxic movie", "Yash Toxic"]),
    ("War 2", ["war 2", "War2", "Hrithik War 2"]),
    ("Kantara: Chapter 1", ["Kantara 2", "Kantara Chapter 1", "kantara prequel"]),
    ("SSMB29", ["ssmb29", "SSMB 29", "Rajamouli Mahesh movie"]),
    ("Coolie", ["coolie", "Thalaivar 171", "Coolie Rajini"]),
    ("Ramayana: Part 1", ["Ramayana", "ramayan", "Ranbir Ramayana"]),
    ("Good Bad Ugly", ["GBU", "good bad ugly", "Ajith GBU"]),
    ("Empuraan (L2E)", ["Empuraan", "L2E", "Lucifer 2"]),
    ("Game Changer", ["game changer", "Gamechanger", "RC15"])
]

ACTORS = [
    ("Prabhas", ["prabhas", "Prbhas", "Rebel Star"]),
    ("Deepika Padukone", ["Deepika", "Deepka", "deepika padukon"]),
    ("Allu Arjun", ["allu arjun", "AA", "Bunny", "Allu arjun"]),
    ("Shah Rukh Khan", ["SRK", "Shahrukh", "shah rukh khan", "King Khan"]),
    ("Ranbir Kapoor", ["Ranbir", "ranbir kapoor", "RK"]),
    ("Jr NTR", ["NTR", "Tarak", "jr ntr", "Man of Masses NTR"]),
    ("Ram Charan", ["ram charan", "Mega Powerstar", "RC"]),
    ("Rajinikanth", ["Rajini", "rajinikanth", "Thalaivar", "Superstar Rajini"]),
    ("Thalapathy Vijay", ["Vijay", "Thalapathy", "vijay", "Thalapathy Vijay"]),
    ("Yash", ["yash", "Rocking Star Yash", "Rocky Bhai"]),
    ("Rishab Shetty", ["Rishab", "rishab shetty"]),
    ("Trisha Krishnan", ["Trisha", "trisha", "Trisha krishnan"]),
    ("Nayanthara", ["Lady Superstar", "nayanthara", "Nayan"]),
    ("Fahadh Faasil", ["Fahadh", "FaFa", "fahad fasil"]),
    ("Dulquer Salmaan", ["DQ", "dulquer", "Dulquer salman"])
]

DIRECTORS = [
    ("SS Rajamouli", ["Rajamouli", "rajamouli", "SSR"]),
    ("Sandeep Reddy Vanga", ["Vanga", "sandeep vanga", "SRV"]),
    ("Sukumar", ["sukumar", "Sukku"]),
    ("Prashanth Neel", ["prashanth neel", "Neel"]),
    ("Lokesh Kanagaraj", ["Lokesh", "loki", "lokesh kanagaraj"]),
    ("Atlee", ["atlee", "Atlee Kumar"]),
    ("Nelson Dilipkumar", ["nelson", "Nelson Dilipkumar"]),
    ("Ayan Mukerji", ["ayan", "ayan mukerji"])
]

PRODUCTION_HOUSES = [
    "Mythri Movie Makers", "Hombale Films", "Yash Raj Films (YRF)", "Dharma Productions",
    "DVV Entertainment", "Lyca Productions", "Sun Pictures", "Maddock Films",
    "T-Series", "Vyjayanthi Movies", "Red Giant Movies"
]

PLATFORMS = ["Netflix", "Amazon Prime Video", "Disney+ Hotstar", "Zee5", "JioCinema"]
DATES = ["Sankranti 2025", "Diwali 2025", "December 5, 2024", "Summer 2025", "August 15, 2025"]

TYPO_PATTERNS = [
    ("opp", "opposite"),
    ("b/o", "box office"),
    ("BO", "box office"),
    ("dir", "directed by"),
    ("prod", "produced by"),
    ("relase", "release"),
    ("offcial", "official"),
    ("repot", "report"),
    ("confrim", "confirmed"),
    ("rumer", "rumour")
]

def calculate_verification(source_type: str, category: str) -> Dict[str, Any]:
    if source_type == "official":
        src_auth = round(random.uniform(0.90, 1.00), 2)
        ent_feas = round(random.uniform(0.85, 1.00), 2)
        time_feas = round(random.uniform(0.85, 1.00), 2)
        dispute_pen = 0.0
        verdict = "CONFIRMED_OFFICIAL"
        reason = "Officially confirmed by production house or verified filmmaker handles."
    elif source_type == "trade":
        src_auth = round(random.uniform(0.70, 0.85), 2)
        ent_feas = round(random.uniform(0.75, 0.90), 2)
        time_feas = round(random.uniform(0.70, 0.85), 2)
        dispute_pen = 0.0
        verdict = "HIGHLY_PLAUSIBLE"
        reason = "Reported by credible trade analysts and box office tracking portals."
    elif source_type == "rumour":
        src_auth = round(random.uniform(0.25, 0.45), 2)
        ent_feas = round(random.uniform(0.40, 0.65), 2)
        time_feas = round(random.uniform(0.50, 0.70), 2)
        dispute_pen = 0.10
        verdict = "UNVERIFIED_RUMOUR"
        reason = "Originating from unverified social media fan pages without trade backing."
    else:
        src_auth = round(random.uniform(0.10, 0.30), 2)
        ent_feas = round(random.uniform(0.20, 0.40), 2)
        time_feas = round(random.uniform(0.20, 0.40), 2)
        dispute_pen = 0.40
        verdict = "DEBUNKED_FAKE"
        reason = "Directly contradicted by official production schedules or makers' statements."

    c1 = round(0.40 * src_auth, 3)
    c2 = round(0.35 * ent_feas, 3)
    c3 = round(0.25 * time_feas, 3)
    raw_score = round(c1 + c2 + c3 - dispute_pen, 3)
    final_score = max(0.05, min(0.99, raw_score))
    pct = int(round(final_score * 100))

    formula_str = f"Score = (0.40 * {src_auth:.2f}) + (0.35 * {ent_feas:.2f}) + (0.25 * {time_feas:.2f}) - {dispute_pen:.2f}"
    step_str = f"{c1:.3f} + {c2:.3f} + {c3:.3f} - {dispute_pen:.2f} = {raw_score:.3f} ({pct}%)"

    return {
        "verdict": verdict,
        "confidence_score": final_score,
        "calculation": {
            "source_authority": src_auth,
            "entity_feasibility": ent_feas,
            "timeline_feasibility": time_feas,
            "dispute_penalty": dispute_pen,
            "formula": formula_str,
            "step_by_step": step_str
        },
        "verdict_reasoning": reason
    }

def generate_sample(category: str, source_type: str) -> Dict[str, Any]:
    movie_clean, movie_variants = random.choice(MOVIES)
    actor_clean, actor_variants = random.choice(ACTORS)
    director_clean, director_variants = random.choice(DIRECTORS)
    prod = random.choice(PRODUCTION_HOUSES)
    date = random.choice(DATES)
    platform = random.choice(PLATFORMS)
    amount = random.choice(["₹85 Crore", "₹120 Crore", "₹200 Crore", "₹500 Crore", "₹1000 Crore"])
    
    # Introduce noisy variations for training typo correction and text refinement
    noisy_actor = random.choice(actor_variants)
    noisy_movie = random.choice(movie_variants)
    noisy_director = random.choice(director_variants)
    
    typos_fixed = []
    if noisy_actor != actor_clean:
        typos_fixed.append(f"'{noisy_actor}' -> '{actor_clean}'")
    if noisy_movie != movie_clean:
        typos_fixed.append(f"'{noisy_movie}' -> '{movie_clean}'")

    if category == "casting":
        lead_clean, lead_vars = actor_clean, actor_variants
        supp_clean, supp_vars = random.choice([a for a in ACTORS if a[0] != lead_clean])
        noisy_supp = random.choice(supp_vars)
        if noisy_supp != supp_clean:
            typos_fixed.append(f"'{noisy_supp}' -> '{supp_clean}'")
            
        if source_type == "official":
            raw_input = f"OFFICIAL: {noisy_supp} join {noisy_movie} opp {noisy_actor} confirm!"
            cleaned = f"Official: {supp_clean} joins {movie_clean} opposite {lead_clean}."
            claim = f"{supp_clean} has been officially cast opposite {lead_clean} in {movie_clean}."
            simplified = f"{supp_clean} will co-star with {lead_clean} in {movie_clean}."
            descriptive = f"The production team has officially welcomed {supp_clean} to the cast of {movie_clean} alongside {lead_clean}. The casting is verified by official production announcements, giving it a top-tier credibility score."
        elif source_type == "trade":
            raw_input = f"trade buzz: {noisy_supp} roped in for big role in {noisy_movie} with {noisy_actor}"
            cleaned = f"Trade Buzz: {supp_clean} roped in for key role in {movie_clean} with {lead_clean}."
            claim = f"{supp_clean} is reported to play a significant role in {movie_clean} with {lead_clean}."
            simplified = f"{supp_clean} is likely joining {lead_clean}'s movie {movie_clean}."
            descriptive = f"Trade analysts report active casting discussions between {supp_clean} and the makers of {movie_clean}. While formal contract signing is pending final paperwork, multiple credible sources confirm strong feasibility."
        elif source_type == "rumour":
            raw_input = f"buzz: {noisy_supp} walked out of {noisy_movie} due to dates clashes"
            cleaned = f"Buzz: {supp_clean} walked out of {movie_clean} due to scheduling conflicts."
            claim = f"{supp_clean} has reportedly exited {movie_clean} over scheduling issues."
            simplified = f"{supp_clean} might not act in {movie_clean} due to date problems."
            descriptive = f"Social media rumors claim that {supp_clean} has left {movie_clean}. However, neither the actor's PR nor the production house has confirmed any departure, categorizing this assertion as an unverified rumor."
        else:
            raw_input = f"fake news alert: {noisy_supp} replaced in {noisy_movie} debunked"
            cleaned = f"Clarification: Reports claiming {supp_clean} was replaced in {movie_clean} are debunked."
            claim = f"Claims that {supp_clean} was replaced in {movie_clean} have been refuted."
            simplified = f"{supp_clean} is NOT removed from {movie_clean}."
            descriptive = f"Speculation alleging that {supp_clean} was dropped from {movie_clean} has been firmly denied by the filmmakers, confirming the rumor as false."

        entities = {"movie": movie_clean, "person": f"{supp_clean}, {lead_clean}", "production_house": None, "date": None, "platform": None, "amount": None}

    elif category == "movie_announcement":
        if source_type == "official":
            raw_input = f"{prod} formal pooja done for {noisy_movie} dir by {noisy_director} starrer {noisy_actor}"
            cleaned = f"{prod} formal pooja ceremony concluded for {movie_clean} directed by {director_clean} starring {actor_clean}."
            claim = f"{prod} officially launched {movie_clean} with {director_clean} and {actor_clean}."
            simplified = f"Director {director_clean} and actor {actor_clean} are making '{movie_clean}' with {prod}."
            descriptive = f"{prod} has officially commenced production on '{movie_clean}' starring {actor_clean} under the direction of {director_clean}. The project was formally launched with a traditional pooja ceremony, confirming its authenticity."
        else:
            raw_input = f"massive buzz {noisy_director} next with {noisy_actor} titled {noisy_movie}?"
            cleaned = f"Buzz: {director_clean}'s next venture with {actor_clean} tentatively titled {movie_clean}."
            claim = f"{director_clean} and {actor_clean} are reportedly collaborating on {movie_clean}."
            simplified = f"{director_clean} and {actor_clean} might be teaming up for a new movie."
            descriptive = f"Industry reports suggest discussions between {director_clean} and {actor_clean} for an upcoming feature titled {movie_clean}. While highly anticipated across trade circles, an official title reveal from the studio is awaited."

        entities = {"movie": movie_clean, "person": f"{director_clean}, {actor_clean}", "production_house": prod, "date": None, "platform": None, "amount": None}

    elif category == "release_update":
        if source_type == "official":
            raw_input = f"relase date locked: {noisy_movie} arrving in theaters on {date}!"
            cleaned = f"Release date locked: {movie_clean} arriving in theatres on {date}."
            claim = f"{movie_clean} will release in theatres on {date}."
            simplified = f"{movie_clean} is scheduled to hit theatres on {date}."
            descriptive = f"The producers have locked {date} as the worldwide theatrical release date for {movie_clean}. The date is locked in cinema exhibitor calendars, representing a confirmed release commitment."
        else:
            raw_input = f"postponed? {noisy_movie} relase pushed past {date} due to vfx"
            cleaned = f"Rumour: {movie_clean} release reportedly pushed past {date} due to post-production delays."
            claim = f"{movie_clean} may be postponed beyond {date} due to VFX work."
            simplified = f"{movie_clean} might get delayed past {date}."
            descriptive = f"Speculation has emerged regarding potential release delays for {movie_clean} beyond {date}. While VFX completion timelines remain tight, the studio has not issued a postponement notice, leaving the claim unverified."

        entities = {"movie": movie_clean, "person": actor_clean, "production_house": None, "date": date, "platform": None, "amount": None}

    else:  # box_office
        if source_type == "official":
            raw_input = f"box ofice record: {noisy_movie} enters {amount} club worldwide!"
            cleaned = f"Box Office Record: {movie_clean} enters the {amount} club worldwide."
            claim = f"{movie_clean} has grossed {amount} worldwide."
            simplified = f"{movie_clean} has officially earned over {amount} globally."
            descriptive = f"Producers and tracking partners confirm {movie_clean} has achieved the milestone of {amount} in worldwide gross collections. Box office receipts across domestic and international territories corroborate the milestone."
        else:
            raw_input = f"fan claim: {noisy_actor} {noisy_movie} collected {amount} in 2 days"
            cleaned = f"Claim: {actor_clean}'s {movie_clean} allegedly collected {amount} in two days."
            claim = f"Social media posts claim {movie_clean} starring {actor_clean} grossed {amount} in two days."
            simplified = f"Unverified claim that {movie_clean} earned {amount} in just two days."
            descriptive = f"Social media fan handles have shared claims of {movie_clean} achieving {amount} in 48 hours. However, verified trade trackers like Sacnilk and Comscore report substantially lower actual figures, indicating inflated estimates."

        entities = {"movie": movie_clean, "person": actor_clean, "production_house": None, "date": None, "platform": None, "amount": amount}

    if not typos_fixed:
        typos_fixed.append("No critical typos detected; punctuation and casing standardized.")

    verification = calculate_verification(source_type, category)

    assistant_payload = {
        "text_refinement": {
            "cleaned_text": cleaned,
            "simplified_claim": simplified,
            "typos_fixed": typos_fixed
        },
        "core_claim": claim,
        "category": category,
        "entities": entities,
        "verification": verification,
        "descriptive_answer": descriptive
    }

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_input},
            {"role": "assistant", "content": json.dumps(assistant_payload, ensure_ascii=False)}
        ]
    }

def main():
    random.seed(42)
    source_types = ["official", "trade", "rumour", "debunked"]
    samples_per_combo = 35  # 4 * 4 * 35 = 560 rich samples
    
    dataset: List[Dict[str, Any]] = []
    for cat in CATEGORIES:
        for st in source_types:
            for _ in range(samples_per_combo):
                dataset.append(generate_sample(cat, st))
                
    random.shuffle(dataset)
    print(f"Generated {len(dataset)} v3 samples with text refinement and descriptive answers!")
    
    # Contract validation
    for idx, item in enumerate(dataset):
        parsed = json.loads(item["messages"][2]["content"])
        assert "text_refinement" in parsed
        assert "cleaned_text" in parsed["text_refinement"]
        assert "simplified_claim" in parsed["text_refinement"]
        assert "typos_fixed" in parsed["text_refinement"]
        assert "core_claim" in parsed
        assert "category" in parsed
        assert "entities" in parsed
        assert "verification" in parsed
        assert "descriptive_answer" in parsed
        
    split_idx = int(len(dataset) * 0.9)
    train_data = dataset[:split_idx]
    val_data = dataset[split_idx:]
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    train_path = os.path.join(data_dir, "cineverify_train_v3.jsonl")
    val_path = os.path.join(data_dir, "cineverify_val_v3.jsonl")
    
    with open(train_path, "w", encoding="utf-8") as f:
        for entry in train_data:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            
    with open(val_path, "w", encoding="utf-8") as f:
        for entry in val_data:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            
    print(f"Saved {len(train_data)} train samples to {train_path}")
    print(f"Saved {len(val_data)} val samples to {val_path}")

if __name__ == "__main__":
    main()
