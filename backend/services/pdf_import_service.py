"""
Import legal provisions from a PDF into the RAG library.

Ethiopian primary law is often available only as a printed or scanned PDF (and
frequently in Amharic), so this service turns such a file into a list of structured
provisions the admin can review before saving.

Strategy (matches the agreed design):
  1. Try to pull digital text with pypdf (free, instant) — works for born-digital PDFs.
  2. If the PDF has little/no extractable text (i.e. it is scanned images), fall back
     to Gemini's multimodal model, which reads scanned pages AND Amharic.
  3. Either way, Gemini splits the document into one item per article/section.

Nothing here writes to the database — the caller stores the returned list only after
the admin has reviewed it, keeping a human in the loop for the "verified" library.
"""
import io
import os
import json
from typing import List, Dict

# A PDF that yields fewer than this many characters of embedded text is treated as
# scanned, so we send the pages to Gemini's vision model instead of trusting pypdf.
MIN_DIGITAL_TEXT_CHARS = 200

# Safety caps so a huge document can't produce an unbounded response.
MAX_PROVISIONS = 300
MAX_CONTENT_CHARS = 12000

_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def extract_digital_text(pdf_bytes: bytes) -> str:
    """Best-effort digital text extraction with pypdf. Returns '' on any failure."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(parts).strip()
    except Exception as e:
        print(f"[PDF IMPORT] digital text extraction failed: {e}")
        return ""


_EXTRACTION_INSTRUCTION = (
    "You are extracting Ethiopian legal provisions from a document so they can be stored "
    "in a verified legal library. Split the document into its individual provisions — one "
    "item per Article/Section.\n\n"
    "Return ONLY a JSON array. Each item MUST have exactly these keys:\n"
    '  "law_code":  the official law/proclamation name and number, e.g. "Labour Proclamation No. 1156/2019". '
    "Use the document\'s own title and repeat it on every item.\n"
    '  "article":   the article/section label, e.g. "Article 35" (or null if the item has none).\n'
    '  "title":     the short heading of that article (or null).\n'
    '  "content":   the EXACT, verbatim text of that article. Do NOT summarise, paraphrase, translate, '
    "or add anything. Preserve the original wording and language.\n"
    '  "language":  "am" if the content is written in Amharic, otherwise "en".\n\n'
    "Rules: Never invent articles, numbers, or text that is not in the document. If the document is a "
    "single provision, return a one-item array. Output the JSON array and nothing else."
)


def _coerce_provisions(raw) -> List[Dict]:
    """Validate/normalise the model's JSON into clean provision dicts."""
    if isinstance(raw, dict):
        # Model sometimes wraps the array, e.g. {"provisions": [...]}.
        for key in ("provisions", "items", "articles", "data"):
            if isinstance(raw.get(key), list):
                raw = raw[key]
                break
    if not isinstance(raw, list):
        return []

    out: List[Dict] = []
    for item in raw[:MAX_PROVISIONS]:
        if not isinstance(item, dict):
            continue
        law_code = (str(item.get("law_code") or "")).strip()
        content = (str(item.get("content") or "")).strip()
        if not law_code or not content:
            continue  # both are required to store a provision
        lang = (str(item.get("language") or "en")).strip().lower()
        if lang not in ("en", "am"):
            lang = "am" if lang.startswith("am") else "en"
        out.append({
            "law_code": law_code,
            "article": (str(item.get("article") or "")).strip() or None,
            "title": (str(item.get("title") or "")).strip() or None,
            "content": content[:MAX_CONTENT_CHARS],
            "language": lang,
        })
    return out


def _parse_json(text: str):
    """Parse a JSON array from the model output, tolerating code fences/prose."""
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        # Strip a ```json ... ``` fence if present.
        s = s.split("```", 2)[1] if s.count("```") >= 2 else s.strip("`")
        if s.lstrip().lower().startswith("json"):
            s = s.lstrip()[4:]
    s = s.strip()
    try:
        return json.loads(s)
    except Exception:
        # Last resort: grab the outermost [ ... ] span.
        a, b = s.find("["), s.rfind("]")
        if a != -1 and b != -1 and b > a:
            try:
                return json.loads(s[a:b + 1])
            except Exception:
                return None
    return None


def extract_provisions(pdf_bytes: bytes, model: str) -> Dict:
    """Extract structured provisions from a PDF.

    Returns {"provisions": [...], "method": "text"|"vision"}. Raises RuntimeError
    with a user-safe message if the model call fails outright.
    """
    from google.genai import types

    digital_text = extract_digital_text(pdf_bytes)
    use_vision = len(digital_text) < MIN_DIGITAL_TEXT_CHARS
    method = "vision" if use_vision else "text"

    if use_vision:
        # Scanned/image PDF (or empty text) — hand the whole file to the vision model.
        parts = [
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            types.Part.from_text(text=_EXTRACTION_INSTRUCTION),
        ]
    else:
        parts = [types.Part.from_text(
            text=_EXTRACTION_INSTRUCTION + "\n\n=== DOCUMENT TEXT ===\n" + digital_text
        )]

    config = types.GenerateContentConfig(
        temperature=0.0,  # deterministic, verbatim extraction
        response_mime_type="application/json",
        system_instruction="You extract legal text verbatim and return strict JSON. You never fabricate.",
    )

    try:
        resp = _get_client().models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=parts)],
            config=config,
        )
    except Exception as e:
        print(f"[PDF IMPORT] extraction call failed ({method}): {e!r}")
        raise RuntimeError("Could not read the PDF. Please try a clearer file.")

    provisions = _coerce_provisions(_parse_json(resp.text or ""))
    return {"provisions": provisions, "method": method}
