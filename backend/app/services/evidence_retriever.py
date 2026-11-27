"""Domain-targeted web search and article passage extraction (owned by Member 2)."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import htmldate
import httpx
import trafilatura
from serpapi import GoogleSearch

from app.config import get_source_credibility, settings
from app.schemas.claim import ClaimCategory, ClaimResult
from app.schemas.evidence import EvidencePassage, SearchResult

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).resolve().parents[2] / ".cache" / "serpapi_cache.json"
MAX_QUERIES = 3
MAX_URLS_TO_FETCH = 6
REQUEST_TIMEOUT_SECONDS = 8.0

_CATEGORY_QUERY_BUILDERS = {
    ClaimCategory.MOVIE_ANNOUNCEMENT: lambda movie, person, house, platform: _join_terms(
        [movie or person, house, "official movie announcement"]
    ),
    ClaimCategory.CASTING: lambda movie, person, house, platform: _join_terms(
        [movie, person, "cast confirmed"]
    ),
    ClaimCategory.RELEASE_UPDATE: lambda movie, person, house, platform: _join_terms(
        [movie, platform, "release date official update"]
    ),
    ClaimCategory.BOX_OFFICE: lambda movie, person, house, platform: _join_terms(
        [movie, "box office collection Sacnilk Bollywood Hungama"]
    ),
}

_TRACKING_PARAM_PREFIXES = ("utm_", "fbclid", "gclid", "ref")


def _join_terms(parts: List[Optional[str]]) -> str:
    """Join non-empty query terms with normalized whitespace."""
    cleaned = [part.strip() for part in parts if part and part.strip()]
    return " ".join(" ".join(cleaned).split())


def generate_search_queries(claim_result: ClaimResult) -> List[str]:
    """Generate 2-3 domain-targeted Indian cinema search queries from a ClaimResult."""
    entities = claim_result.entities
    movie = entities.movie
    person = entities.person
    house = entities.production_house
    platform = entities.platform

    candidates: List[str] = []

    if movie and movie.lower() not in claim_result.core_claim.lower():
        candidates.append(_join_terms([movie, claim_result.core_claim]))
    else:
        candidates.append(_join_terms([claim_result.core_claim]))

    builder = _CATEGORY_QUERY_BUILDERS.get(claim_result.category)
    if builder is not None:
        cat_query = builder(movie, person, house, platform)
        if cat_query:
            candidates.append(cat_query)

    if movie and person:
        candidates.append(_join_terms([movie, person, "latest news official"]))

    seen: set[str] = set()
    unique_queries: List[str] = []
    for query in candidates:
        normalized = query.lower()
        if query and normalized not in seen:
            seen.add(normalized)
            unique_queries.append(query)
        if len(unique_queries) >= MAX_QUERIES:
            break

    return unique_queries


def _load_cache() -> Dict[str, List[Dict[str, Any]]]:
    if not CACHE_FILE.exists():
        return {}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to read SerpAPI cache: %s", exc)
        return {}


def _save_cache(cache: Dict[str, List[Dict[str, Any]]]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(
            json.dumps(cache, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Failed to write SerpAPI cache: %s", exc)


def search_web(query: str, num_results: int = 6) -> List[SearchResult]:
    """Query SerpAPI for India-focused results with a local JSON dev cache."""
    cache_key = f"{query.strip().lower()}::{num_results}"
    cache = _load_cache()
    if cache_key in cache:
        return [SearchResult(**item) for item in cache[cache_key]]

    if not settings.SERPAPI_KEY or settings.SERPAPI_KEY == "your_serpapi_key_here":
        logger.warning("SERPAPI_KEY not configured; skipping live web search.")
        return []

    params = {
        "engine": "google",
        "q": query,
        "api_key": settings.SERPAPI_KEY,
        "num": num_results,
        "gl": "in",
        "hl": "en",
    }
    raw_response = GoogleSearch(params).get_dict()
    if "error" in raw_response:
        logger.error("SerpAPI returned an error: %s", raw_response["error"])
        return []
    organic = raw_response.get("organic_results", [])

    results: List[SearchResult] = []
    for item in organic:
        url = item.get("link")
        title = item.get("title", "").strip()
        if not url or not title:
            continue
        results.append(
            SearchResult(
                title=title,
                url=url,
                snippet=(item.get("snippet") or "").strip(),
                displayed_date=item.get("date"),
            )
        )

    cache[cache_key] = [item.model_dump(mode="json") for item in results]
    _save_cache(cache)
    return results


def normalize_url(url: str) -> str:
    """Strip common tracking query parameters and trailing slashes for deduplication."""
    parsed = urlparse(url.strip())
    filtered_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith(_TRACKING_PARAM_PREFIXES)
    ]
    cleaned_path = parsed.path.rstrip("/") or "/"
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            cleaned_path,
            "",
            urlencode(filtered_query),
            "",
        )
    )


def deduplicate_and_rank_results(results: List[SearchResult]) -> List[SearchResult]:
    """Deduplicate search results by normalized URL and prioritize credible sources."""
    seen: set[str] = set()
    unique: List[SearchResult] = []
    for item in results:
        norm = normalize_url(item.url)
        if norm not in seen:
            seen.add(norm)
            unique.append(item)

    unique.sort(key=lambda item: get_source_credibility(item.url), reverse=True)
    return unique


def _extract_source_name(url: str, metadata_sitename: Optional[str]) -> str:
    if metadata_sitename and metadata_sitename.strip():
        return metadata_sitename.strip()
    hostname = (urlparse(url).hostname or "unknown").lower()
    return hostname[4:] if hostname.startswith("www.") else hostname


def extract_article_from_html(
    html: str,
    url: str,
    fallback_title: str = "",
    fallback_snippet: str = "",
    fallback_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Extract clean article text, title, date, and source name from HTML."""
    extracted_text = trafilatura.extract(
        html,
        include_comments=False,
        include_tables=True,
    )
    metadata = trafilatura.extract_metadata(html)

    title = (metadata.title if metadata and metadata.title else "") or fallback_title
    pub_date = metadata.date if metadata and metadata.date else None
    if not pub_date:
        try:
            pub_date = htmldate.find_date(html, outputformat="%Y-%m-%d")
        except Exception:
            pub_date = None

    return {
        "title": title.strip(),
        "text": (extracted_text or fallback_snippet or "").strip(),
        "published_date": pub_date or fallback_date,
        "source_name": _extract_source_name(
            url,
            metadata.sitename if metadata else None,
        ),
        "url": url,
    }


def chunk_article_text(
    text: str,
    max_words: int = 240,
    max_chunks: int = 3,
) -> List[str]:
    """Split article body text into paragraph-aware passages capped for fast NLI."""
    paragraphs = [" ".join(p.split()) for p in text.splitlines() if p.strip()]
    if not paragraphs:
        return []

    chunks: List[str] = []
    current_parts: List[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        if len(words) > max_words and not current_parts:
            # Split oversized single-paragraph blocks cleanly on word boundaries.
            for start in range(0, len(words), max_words):
                chunks.append(" ".join(words[start : start + max_words]))
                if len(chunks) >= max_chunks:
                    return chunks
            continue

        if current_words + len(words) > max_words and current_parts:
            chunks.append(" ".join(current_parts))
            if len(chunks) >= max_chunks:
                return chunks
            current_parts = [paragraph]
            current_words = len(words)
        else:
            current_parts.append(paragraph)
            current_words += len(words)

    if current_parts and len(chunks) < max_chunks:
        chunks.append(" ".join(current_parts))

    return chunks


async def _fetch_article(
    client: httpx.AsyncClient,
    result: SearchResult,
) -> Optional[Dict[str, Any]]:
    """Download and extract a single article, falling back to snippet on fetch error."""
    try:
        response = await client.get(result.url)
        response.raise_for_status()
        article = extract_article_from_html(
            html=response.text,
            url=str(response.url),
            fallback_title=result.title,
            fallback_snippet=result.snippet,
            fallback_date=result.displayed_date,
        )
        if article["text"]:
            return article
    except Exception as exc:
        logger.debug("Fetch failed for %s (%s); using snippet fallback.", result.url, exc)

    if result.snippet.strip():
        return {
            "title": result.title,
            "text": result.snippet.strip(),
            "published_date": result.displayed_date,
            "source_name": _extract_source_name(result.url, None),
            "url": result.url,
        }
    return None


async def retrieve_evidence(claim_result: ClaimResult) -> List[EvidencePassage]:
    """Retrieve, extract, chunk, and score credible evidence passages for a claim."""
    queries = generate_search_queries(claim_result)
    if not queries:
        return []

    search_tasks = [asyncio.to_thread(search_web, query) for query in queries]
    search_batches = await asyncio.gather(*search_tasks, return_exceptions=True)

    raw_results: List[SearchResult] = []
    for batch in search_batches:
        if isinstance(batch, Exception):
            logger.warning("Search query failed: %s", batch)
            continue
        raw_results.extend(batch)

    top_results = deduplicate_and_rank_results(raw_results)[:MAX_URLS_TO_FETCH]
    if not top_results:
        return []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers=headers,
    ) as client:
        fetched = await asyncio.gather(
            *[_fetch_article(client, item) for item in top_results],
            return_exceptions=True,
        )

    passages: List[EvidencePassage] = []
    for article in fetched:
        if isinstance(article, Exception) or not article:
            continue
        credibility = get_source_credibility(article["url"])
        for chunk in chunk_article_text(article["text"]):
            passages.append(
                EvidencePassage(
                    source_name=article["source_name"],
                    url=article["url"],
                    title=article["title"],
                    published_date=article["published_date"],
                    text=chunk,
                    credibility_score=credibility,
                )
            )

    return passages
