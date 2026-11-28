"""Domain-targeted web search and article passage extraction (owned by Member 2)."""

from __future__ import annotations

import asyncio
from functools import lru_cache
import json
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import htmldate
import httpx
import numpy as np
from sentence_transformers import SentenceTransformer
import trafilatura

from app.config import get_source_credibility, settings
from app.core.models_config import EMBEDDING_MODEL_NAME
from app.schemas.claim import ClaimCategory, ClaimResult
from app.schemas.evidence import EvidencePassage, SearchResult

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).resolve().parents[2] / ".cache" / "serpapi_cache.json"
MAX_QUERIES = 2
MAX_URLS_TO_FETCH = 4
REQUEST_TIMEOUT_SECONDS = 2.2
_MAX_HTML_CHARS = 450_000

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
_MEM_CACHE: Optional[Dict[str, List[Dict[str, Any]]]] = None


def _join_terms(parts: List[Optional[str]]) -> str:
    """Join non-empty query terms with normalized whitespace."""
    cleaned = [part.strip() for part in parts if part and part.strip()]
    return " ".join(" ".join(cleaned).split())


def generate_search_queries(claim_result: ClaimResult) -> List[str]:
    """Generate 2 domain-targeted Indian cinema search queries from a ClaimResult."""
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
    global _MEM_CACHE
    if _MEM_CACHE is not None:
        return _MEM_CACHE
    if not CACHE_FILE.exists():
        _MEM_CACHE = {}
        return _MEM_CACHE
    try:
        _MEM_CACHE = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to read SerpAPI cache: %s", exc)
        _MEM_CACHE = {}
    return _MEM_CACHE


def _save_cache(cache: Dict[str, List[Dict[str, Any]]]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(
            json.dumps(cache, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Failed to write SerpAPI cache: %s", exc)


def _clean_rss_title(title: str, source_name: Optional[str]) -> str:
    """Strip trailing ' - Publisher' suffix added by Google News RSS."""
    cleaned = " ".join(title.split())
    if source_name and cleaned.endswith(f" - {source_name}"):
        cleaned = cleaned[: -len(source_name) - 3].strip()
    return cleaned


def _search_rss_sources(query: str, num_results: int = 8) -> List[SearchResult]:
    """Zero-key, free live web search using Google News RSS and Bing News RSS with real source extraction."""
    from urllib.parse import parse_qs, quote_plus
    import xml.etree.ElementTree as ET
    from bs4 import BeautifulSoup

    results: List[SearchResult] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        )
    }

    # 1. Google News RSS for India (en-IN) — preserves real publisher via <source url="...">
    try:
        gnews_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        with httpx.Client(timeout=4.5, headers=headers, follow_redirects=True) as client:
            resp = client.get(gnews_url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                for item in root.findall(".//item"):
                    raw_title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    pub_date = (item.findtext("pubDate") or "").strip()

                    source_el = item.find("source")
                    source_name = (source_el.text or "").strip() if source_el is not None else None
                    source_url = (source_el.attrib.get("url") or "").strip() if source_el is not None else ""
                    source_domain = urlparse(source_url).hostname if source_url else None

                    title = _clean_rss_title(raw_title, source_name)
                    desc_raw = (item.findtext("description") or "").strip()
                    snippet = ""
                    if desc_raw:
                        soup = BeautifulSoup(desc_raw, "html.parser")
                        snippet = soup.get_text(separator=" ", strip=True)
                        # Google News description repeats title + publisher; strip duplicate publisher suffix
                        snippet = _clean_rss_title(snippet, source_name)
                    if not snippet or len(snippet) < 12 or snippet == title:
                        snippet = title

                    title_key = title.lower()[:65]
                    if link and title and link not in seen_urls and title_key not in seen_titles:
                        seen_urls.add(link)
                        seen_titles.add(title_key)
                        results.append(
                            SearchResult(
                                title=title,
                                url=link,
                                snippet=snippet,
                                displayed_date=pub_date[:16] if pub_date else None,
                                source_name=source_name,
                                source_domain=source_domain,
                            )
                        )
                    if len(results) >= num_results:
                        break
    except Exception as exc:
        logger.debug("Google News RSS search failed: %s", exc)

    # 2. Bing News RSS — extracts real target URL from apiclick wrapper
    if len(results) < num_results:
        try:
            bing_url = f"https://www.bing.com/news/search?q={quote_plus(query)}&format=rss"
            with httpx.Client(timeout=4.5, headers=headers, follow_redirects=True) as client:
                resp = client.get(bing_url)
                if resp.status_code == 200:
                    root = ET.fromstring(resp.text)
                    for item in root.findall(".//item"):
                        title = " ".join((item.findtext("title") or "").split())
                        raw_link = (item.findtext("link") or "").strip()
                        desc = " ".join((item.findtext("description") or "").split())
                        pub_date = (item.findtext("pubDate") or "").strip()

                        real_url = raw_link
                        if "bing.com/news/apiclick" in raw_link:
                            qs = parse_qs(urlparse(raw_link).query)
                            if qs.get("url"):
                                real_url = qs["url"][0]

                        source_name = None
                        for child in item:
                            if child.tag.lower().endswith("source") and child.text:
                                source_name = child.text.strip()
                                break
                        source_domain = urlparse(real_url).hostname if real_url else None

                        title_key = title.lower()[:65]
                        if real_url and title and real_url not in seen_urls and title_key not in seen_titles:
                            seen_urls.add(real_url)
                            seen_titles.add(title_key)
                            results.append(
                                SearchResult(
                                    title=title,
                                    url=real_url,
                                    snippet=desc or title,
                                    displayed_date=pub_date[:16] if pub_date else None,
                                    source_name=source_name,
                                    source_domain=source_domain,
                                )
                            )
                        if len(results) >= num_results:
                            break
        except Exception as exc:
            logger.debug("Bing News RSS search failed: %s", exc)

    return results


def search_web(query: str, num_results: int = 8) -> List[SearchResult]:
    """Query zero-key live web search with in-memory + disk dev cache (optional SerpAPI fallback)."""
    cache_key = f"rss_v2::{query.strip().lower()}::{num_results}"
    cache = _load_cache()
    if cache_key in cache:
        return [SearchResult(**item) for item in cache[cache_key]]

    results: List[SearchResult] = []

    # Optional SerpAPI if key is provided and valid
    if settings.SERPAPI_KEY and settings.SERPAPI_KEY != "your_serpapi_key_here":
        try:
            from serpapi import GoogleSearch  # lazy import
            params = {
                "engine": "google",
                "q": query,
                "api_key": settings.SERPAPI_KEY,
                "num": num_results,
                "gl": "in",
                "hl": "en",
            }
            raw_response = GoogleSearch(params).get_dict()
            if "organic_results" in raw_response:
                for item in raw_response["organic_results"]:
                    url = item.get("link")
                    title = item.get("title", "").strip()
                    if url and title:
                        results.append(
                            SearchResult(
                                title=title,
                                url=url,
                                snippet=(item.get("snippet") or "").strip(),
                                displayed_date=item.get("date"),
                            )
                        )
        except Exception as exc:
            logger.warning("SerpAPI lookup failed (%s); switching to zero-key RSS search.", exc)

    # Zero-key live web search
    if not results:
        results = _search_rss_sources(query, num_results=num_results)

    if results:
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


_RSS_STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "will", "has", "have", "been",
    "box", "office", "worldwide", "crore", "cr", "film", "movie", "next", "new", "news",
    "official", "update", "report", "latest", "release", "date", "crossed", "begins",
    "shooting", "action", "thriller", "releasing", "christmas", "joins", "opposite",
}


def _extract_anchor_terms(claim_result: Optional[ClaimResult]) -> set[str]:
    """Extract distinctive entity anchor keywords (movie/person names) to filter unrelated RSS noise."""
    if claim_result is None:
        return set()
    parts = [
        claim_result.entities.movie or "",
        claim_result.entities.person or "",
        claim_result.submitted_claim or "",
        claim_result.core_claim or "",
    ]
    tokens = re.findall(r"[a-z0-9]{3,}", " ".join(parts).lower())
    anchors = {t for t in tokens if t not in _RSS_STOPWORDS and not t.isdigit()}
    return anchors


def _result_credibility(item: SearchResult) -> float:
    if item.source_domain:
        score = get_source_credibility(f"https://{item.source_domain}")
        if score > 0.40:
            return score
    return get_source_credibility(item.url)


def _relevance_score(item: SearchResult, anchor_terms: set[str], primary_entity: Optional[str] = None) -> float:
    haystack = f"{item.title} {item.snippet}".lower()
    if not anchor_terms:
        return 0.5
    hay_tokens = set(re.findall(r"[a-z0-9]{3,}", haystack))
    overlap = len(anchor_terms & hay_tokens) / max(1, min(len(anchor_terms), 4))
    bonus = 0.0
    if primary_entity:
        primary_words = [w for w in re.findall(r"[a-z0-9]{3,}", primary_entity.lower()) if w not in _RSS_STOPWORDS]
        if primary_words and any(w in haystack for w in primary_words):
            bonus = 0.5
    return min(1.5, overlap + bonus)


def deduplicate_and_rank_results(
    results: List[SearchResult],
    claim_result: Optional[ClaimResult] = None,
) -> List[SearchResult]:
    """Deduplicate search results by normalized URL and prioritize relevant, credible sources."""
    seen: set[str] = set()
    seen_titles: set[str] = set()
    unique: List[SearchResult] = []
    for item in results:
        norm = normalize_url(item.url)
        title_key = " ".join(item.title.lower().split())[:60]
        if norm not in seen and title_key not in seen_titles:
            seen.add(norm)
            seen_titles.add(title_key)
            unique.append(item)

    anchors = _extract_anchor_terms(claim_result)
    primary_entity = claim_result.entities.movie if claim_result else None

    if anchors:
        filtered = [
            item for item in unique
            if _relevance_score(item, anchors, primary_entity) > 0.25
        ]
        if filtered:
            unique = filtered

    unique.sort(
        key=lambda item: (
            round(_relevance_score(item, anchors, primary_entity), 1),
            _result_credibility(item),
        ),
        reverse=True,
    )
    return unique


def _extract_source_name(url: str, metadata_sitename: Optional[str]) -> str:
    if metadata_sitename and metadata_sitename.strip() and metadata_sitename.strip().lower() not in {"news", "bing"}:
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
    bounded_html = html[:_MAX_HTML_CHARS]
    extracted_text = trafilatura.extract(
        bounded_html,
        include_comments=False,
        include_tables=True,
    )
    metadata = trafilatura.extract_metadata(bounded_html)

    title = (metadata.title if metadata and metadata.title else "") or fallback_title
    pub_date = metadata.date if metadata and metadata.date else None
    # Skip slow full-DOM htmldate scan when metadata or SerpAPI already supplies a date.
    if not pub_date and not fallback_date:
        try:
            pub_date = htmldate.find_date(bounded_html, outputformat="%Y-%m-%d")
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
    max_words: int = 135,
    max_chunks: int = 6,
) -> List[str]:
    """Split article body text into focused paragraph-aware passages for fast NLI."""
    paragraphs = [" ".join(p.split()) for p in text.splitlines() if p.strip()]
    if not paragraphs:
        return []

    chunks: List[str] = []
    current_parts: List[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        if len(words) > max_words and not current_parts:
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


@lru_cache(maxsize=1)
def _get_embedding_model() -> Optional[SentenceTransformer]:
    """Lazy-load bi-encoder for semantic passage ranking, or None if unavailable."""
    try:
        return SentenceTransformer(EMBEDDING_MODEL_NAME)
    except Exception as exc:
        logger.warning("Embedding model unavailable (%s); using lexical chunk ranking.", exc)
        return None


def _lexical_overlap_score(query: str, text: str) -> float:
    q_tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    if not q_tokens:
        return 0.0
    t_tokens = set(re.findall(r"[a-z0-9]+", text.lower()))
    return len(q_tokens & t_tokens) / len(q_tokens)


def select_relevant_chunks(
    claim_text: str,
    chunks: List[str],
    max_chunks: int = 2,
) -> List[str]:
    """Select the top chunks most relevant to claim_text while preserving order."""
    if len(chunks) <= max_chunks or not claim_text.strip():
        return chunks[:max_chunks]

    scores: Optional[List[float]] = None
    model = _get_embedding_model()
    if model is not None:
        try:
            vectors = model.encode(
                [claim_text, *chunks],
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            sims = np.dot(vectors[1:], vectors[0])
            scores = [float(s) for s in sims]
        except Exception as exc:
            logger.debug("Semantic chunk scoring failed (%s); falling back to lexical.", exc)

    if scores is None:
        scores = [_lexical_overlap_score(claim_text, chunk) for chunk in chunks]

    ranked_indices = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)[:max_chunks]
    ranked_indices.sort()
    return [chunks[i] for i in ranked_indices]


def select_best_chunks_batch(
    claim_text: str,
    article_chunks: List[List[str]],
    max_chunks_per_article: int = 1,
) -> List[List[str]]:
    """Batch-rank candidate chunks across all articles in a single encoder pass."""
    flat_chunks: List[str] = []
    slices: List[tuple[int, int]] = []
    for chunks in article_chunks:
        start = len(flat_chunks)
        flat_chunks.extend(chunks)
        slices.append((start, len(flat_chunks)))

    if not flat_chunks:
        return [[] for _ in article_chunks]

    flat_scores: Optional[List[float]] = None
    model = _get_embedding_model()
    if model is not None and claim_text.strip():
        try:
            vectors = model.encode(
                [claim_text, *flat_chunks],
                batch_size=32,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            sims = np.dot(vectors[1:], vectors[0])
            flat_scores = [float(s) for s in sims]
        except Exception as exc:
            logger.debug("Batch semantic chunk scoring failed (%s); using lexical.", exc)

    if flat_scores is None:
        flat_scores = [_lexical_overlap_score(claim_text, c) for c in flat_chunks]

    selected_per_article: List[List[str]] = []
    for chunks, (start, end) in zip(article_chunks, slices):
        if len(chunks) <= max_chunks_per_article:
            selected_per_article.append(chunks[:max_chunks_per_article])
            continue
        local_scores = flat_scores[start:end]
        ranked = sorted(range(len(chunks)), key=lambda i: local_scores[i], reverse=True)[:max_chunks_per_article]
        ranked.sort()
        selected_per_article.append([chunks[i] for i in ranked])
    return selected_per_article


async def _fetch_article(
    client: httpx.AsyncClient,
    result: SearchResult,
) -> Optional[Dict[str, Any]]:
    """Download and extract a single article, preserving true publisher source attribution."""
    fallback_source = result.source_name or _extract_source_name(
        f"https://{result.source_domain}" if result.source_domain else result.url, None
    )
    source_domain = result.source_domain

    # Google News RSS article URLs are encrypted redirect tokens that don't expose HTML directly
    is_google_redirect = "news.google.com/rss/articles/" in result.url
    if not is_google_redirect:
        try:
            response = await client.get(result.url)
            response.raise_for_status()
            article = await asyncio.to_thread(
                extract_article_from_html,
                response.text,
                str(response.url),
                result.title,
                result.snippet,
                result.displayed_date,
            )
            if article["text"] and "google news" not in article["text"].lower()[:60]:
                if article["source_name"].lower() in {"news", "google news", "unknown"} and result.source_name:
                    article["source_name"] = result.source_name
                article["source_domain"] = source_domain or urlparse(article["url"]).hostname
                return article
        except Exception as exc:
            logger.debug("Fetch failed for %s (%s); using RSS snippet fallback.", result.url, exc)

    text_body = result.snippet.strip() or result.title.strip()
    if text_body:
        return {
            "title": result.title,
            "text": text_body,
            "published_date": result.displayed_date,
            "source_name": fallback_source,
            "source_domain": source_domain,
            "url": result.url,
        }
    return None


async def retrieve_evidence(
    claim_result: ClaimResult,
    prefetched_results: Optional[List[SearchResult]] = None,
    prefetched_query: Optional[str] = None,
) -> List[EvidencePassage]:
    """Retrieve, extract, batch-rank, and score credible evidence passages for a claim."""
    queries = generate_search_queries(claim_result)
    raw_results: List[SearchResult] = list(prefetched_results or [])

    norm_prefetched = (prefetched_query or "").strip().lower()
    remaining_queries = [q for q in queries if q.strip().lower() != norm_prefetched]

    high_cred_prefetched = sum(
        1
        for item in deduplicate_and_rank_results(raw_results, claim_result)
        if _result_credibility(item) >= 0.72
    )
    if high_cred_prefetched >= 3 and raw_results:
        remaining_queries = []

    if remaining_queries:
        search_tasks = [asyncio.to_thread(search_web, query) for query in remaining_queries]
        search_batches = await asyncio.gather(*search_tasks, return_exceptions=True)
        for batch in search_batches:
            if isinstance(batch, Exception):
                logger.warning("Search query failed: %s", batch)
                continue
            raw_results.extend(batch)

    top_results = deduplicate_and_rank_results(raw_results, claim_result)[:MAX_URLS_TO_FETCH]
    if not top_results:
        return []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        )
    }
    timeout = httpx.Timeout(REQUEST_TIMEOUT_SECONDS, connect=1.2)
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers=headers,
    ) as client:
        fetched = await asyncio.gather(
            *[_fetch_article(client, item) for item in top_results],
            return_exceptions=True,
        )

    valid_articles: List[Dict[str, Any]] = [
        article for article in fetched if not isinstance(article, Exception) and article
    ]
    if not valid_articles:
        return []

    candidate_lists = [chunk_article_text(article["text"]) for article in valid_articles]
    selected_lists = await asyncio.to_thread(
        select_best_chunks_batch,
        claim_result.core_claim,
        candidate_lists,
        1,
    )

    passages: List[EvidencePassage] = []
    for article, selected_chunks in zip(valid_articles, selected_lists):
        cred_url = f"https://{article['source_domain']}" if article.get("source_domain") else article["url"]
        credibility = get_source_credibility(cred_url)
        if credibility <= 0.40:
            credibility = get_source_credibility(article["url"])
        for chunk in selected_chunks:
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
