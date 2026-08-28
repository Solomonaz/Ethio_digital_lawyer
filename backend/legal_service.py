"""
Retrieval-Augmented Generation for grounded Ethiopian legal answers.

Embeds text with Gemini and retrieves the most relevant verified provisions from
the legal_provisions table (pgvector cosine similarity). The retrieved provisions
are injected into the model's system instruction so it can cite real law instead
of inventing citations.
"""
import os
import re
from typing import List, Tuple
from sqlalchemy.orm import Session

from models import LegalProvision, LEGAL_EMBED_DIM

EMBED_MODEL = "gemini-embedding-001"

# Cosine distance gates (0 = identical, 2 = opposite):
#  - MAX: never use a provision less similar than this (filters off-topic matches;
#    tuned so genuinely-relevant provisions (<=~0.38) pass while marginal ones
#    (>=~0.44, incl. the tighter-clustering Amharic embeddings) are excluded).
#  - GAP: within the results, drop provisions much less similar than the best match.
DEFAULT_MAX_DISTANCE = 0.42
DEFAULT_RELATIVE_GAP = 0.12
DEFAULT_TOP_K = 5

_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def embed_text(text_value: str) -> List[float]:
    """Return a 768-d embedding for the given text (raises on failure)."""
    from google.genai import types
    resp = _get_client().models.embed_content(
        model=EMBED_MODEL,
        contents=text_value,
        config=types.EmbedContentConfig(output_dimensionality=LEGAL_EMBED_DIM),
    )
    return list(resp.embeddings[0].values)


def search_provisions(
    db: Session,
    query: str,
    top_k: int = DEFAULT_TOP_K,
    max_distance: float = DEFAULT_MAX_DISTANCE,
    relative_gap: float = DEFAULT_RELATIVE_GAP,
) -> List[Tuple[LegalProvision, float]]:
    """Return [(provision, cosine_distance), ...] for the most relevant provisions."""
    q = (query or "").strip()
    if not q:
        return []
    q_emb = embed_text(q)
    dist = LegalProvision.embedding.cosine_distance(q_emb).label("distance")
    rows = (
        db.query(LegalProvision, dist)
        .filter(LegalProvision.is_active.is_(True))
        .filter(LegalProvision.embedding.isnot(None))
        .order_by(dist)
        .limit(top_k)
        .all()
    )
    candidates = [(p, float(d)) for (p, d) in rows if d is not None and float(d) <= max_distance]
    if not candidates:
        return []
    best = candidates[0][1]
    # Keep only matches close to the best one (tight, relevant citations).
    return [(p, d) for (p, d) in candidates if d <= best + relative_gap]


def build_system_addendum(matches: List[Tuple[LegalProvision, float]]) -> str:
    """Hybrid grounding addendum for the system instruction.

    - If verified provisions matched: prioritise + cite them, but still allow the
      model to complete the answer from general knowledge (never inventing citations).
    - If none matched: answer from general knowledge, flagged as general guidance,
      with no fabricated article numbers.
    """
    if matches:
        parts = [
            "\n\n=== VERIFIED ETHIOPIAN LEGAL SOURCES ===",
            "These provisions were retrieved from the official legal library for this question. "
            "Prioritise them and cite the relevant ones inline using their bracketed reference exactly "
            "as shown (e.g. [Labour Proclamation No. 1156/2019, Article 35]). You MAY also draw on your "
            "general knowledge of Ethiopian law to give a complete answer, but you must NEVER invent "
            "article numbers, proclamations, or provisions beyond those listed here. If these provisions "
            "only partly cover the question, cite them for what they cover and briefly note that the rest "
            "is general guidance to confirm with the official law or a lawyer.",
        ]
        for p, _dist in matches:
            ref = p.law_code + (f", {p.article}" if p.article else "")
            heading = f" — {p.title}" if p.title else ""
            parts.append(f"\n[{ref}]{heading}\n{p.content}")
        return "\n".join(parts)

    # No verified provision matched — general guidance, no fabricated citations.
    return (
        "\n\n=== NO VERIFIED SOURCE MATCHED ===\n"
        "The legal library has no provision matching this question. Still answer helpfully from your "
        "general knowledge of Ethiopian law, but do NOT cite specific article numbers or proclamations "
        "unless you are certain of them — prefer a clear general explanation. Add a short, plain note "
        "that this answer is general guidance not drawn from a verified source in the library, and "
        "recommend confirming with the official law or a licensed Ethiopian lawyer for important matters."
    )


def build_web_search_addendum() -> str:
    """System-instruction addendum for the WEB-SEARCH fallback branch of the hybrid.

    Used only when the verified library had no match AND an admin has enabled web
    grounding. It steers the model to ground its answer in current, authoritative
    Ethiopian sources it finds via the Google Search tool, while keeping the same
    no-fabrication discipline as the DB path.
    """
    return (
        "\n\n=== NO VERIFIED LIBRARY SOURCE — USE WEB SEARCH ===\n"
        "The verified legal library has no provision for this question, so use the Google Search "
        "tool to find current, authoritative Ethiopian legal sources — official proclamations, the "
        "Federal Negarit Gazeta, and government or court publications. Base your answer on what you "
        "actually find and cite the specific law and article. Prefer official/primary sources over "
        "blogs or forums. NEVER fabricate article numbers or proclamations — if you cannot verify a "
        "provision, say so plainly. End with a short note that this answer draws on web sources "
        "(not the verified library) and should be confirmed against the official law or a licensed "
        "Ethiopian lawyer."
    )


def _provision_is_cited(p: LegalProvision, answer_lower: str) -> bool:
    """True if the answer text actually references this provision (its law + article)."""
    if not p.law_code or p.law_code.lower() not in answer_lower:
        return False
    if not p.article:
        return True
    m = re.search(r"(\d+)", p.article)
    if not m:
        return p.article.lower() in answer_lower
    num = m.group(1)
    return (p.article.lower() in answer_lower) or bool(re.search(r"\bart(?:icle|\.)?\s*" + num + r"\b", answer_lower))


def filter_cited(matches: List[Tuple[LegalProvision, float]], answer_text: str) -> List[Tuple[LegalProvision, float]]:
    """Keep only the retrieved provisions the model actually cited in its answer, so
    chips appear only for sources genuinely used (no clutter on general-knowledge answers)."""
    al = (answer_text or "").lower()
    return [(p, d) for (p, d) in matches if _provision_is_cited(p, al)]


def citations_payload(matches: List[Tuple[LegalProvision, float]]) -> List[dict]:
    """Structured citations returned to the client for display."""
    out = []
    for p, dist in matches:
        snippet = (p.content or "").strip()
        if len(snippet) > 240:
            snippet = snippet[:240].rstrip() + "…"
        out.append({
            "id": p.id,
            "law_code": p.law_code,
            "article": p.article,
            "title": p.title,
            "snippet": snippet,
            "source_url": p.source_url,
            "relevance": round(max(0.0, 1.0 - dist / 2.0), 3),  # 1 = perfect, 0 = unrelated
        })
    return out
