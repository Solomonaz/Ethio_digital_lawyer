"""
Verify Supabase-issued user access tokens on the backend.

This project's Supabase signs user JWTs with asymmetric ES256 keys, so tokens are
verified against the project's public JWKS endpoint (no shared secret). Returns the
token claims (sub = Supabase user id, email, ...) on success, or None on any failure.
"""
import os
import time
import requests
from jose import jwt as jose_jwt
from dotenv import load_dotenv

# Load .env before reading SUPABASE_URL so this works regardless of import order.
load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None
_ISSUER = f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else None
_AUDIENCE = "authenticated"

_jwks_cache = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL = 3600  # refresh public keys hourly


def _get_jwks(force: bool = False):
    if not _JWKS_URL:
        return []
    if force or not _jwks_cache["keys"] or (time.time() - _jwks_cache["fetched_at"] > _JWKS_TTL):
        resp = requests.get(_JWKS_URL, timeout=10)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json().get("keys", [])
        _jwks_cache["fetched_at"] = time.time()
    return _jwks_cache["keys"]


def _find_key(kid: str):
    for key in _get_jwks():
        if key.get("kid") == kid:
            return key
    # Key may have rotated — refresh once and try again.
    for key in _get_jwks(force=True):
        if key.get("kid") == kid:
            return key
    return None


def verify_supabase_token(token: str):
    """Return verified claims dict for a valid Supabase access token, else None."""
    if not token or not SUPABASE_URL:
        return None
    try:
        header = jose_jwt.get_unverified_header(token)
    except Exception:
        return None

    # Only handle Supabase's asymmetric tokens here; anything else falls through
    # to the legacy verifier during the migration window.
    if header.get("alg") != "ES256":
        return None

    key = _find_key(header.get("kid"))
    if not key:
        return None

    try:
        return jose_jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience=_AUDIENCE,
            issuer=_ISSUER,
        )
    except Exception:
        return None
