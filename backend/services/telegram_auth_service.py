"""
Telegram Login (Login Widget) — verification + Supabase session bridge.

This is the "Sign in with Telegram" flow, which is DIFFERENT from the phone-code
Gateway flow in telegram_service.py:

  * telegram_service.py       -> sends a 6-digit code to a phone (phone verification)
  * telegram_auth_service.py  -> verifies the Telegram Login Widget payload and turns
                                 that verified identity into a real Supabase session

Why a Supabase session instead of our own token?
The whole app (get_current_user, RLS, /users/me) trusts ONLY Supabase-issued
ES256 JWTs. So after we prove the Telegram login is genuine, we ask Supabase's
Admin API to (a) ensure an auth user exists for this Telegram account and
(b) mint a one-time magic-link token. The frontend exchanges that token via
supabase.auth.verifyOtp() for a normal session — Telegram simply becomes a new
"front door" while Supabase stays the single source of truth for identity.

Required environment variables:
  TELEGRAM_BOT_TOKEN         -- from @BotFather; used to verify the login hash
  SUPABASE_URL               -- already used elsewhere
  SUPABASE_SERVICE_ROLE_KEY  -- Supabase Project Settings -> API -> service_role key
  TELEGRAM_EMAIL_DOMAIN      -- optional; synthetic email domain (default below)
"""
import os
import time
import hmac
import hashlib
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Telegram accounts have no email, so we mint a stable synthetic one per Telegram
# id. It is marked email-confirmed and never receives mail (magic link only).
TELEGRAM_EMAIL_DOMAIN = os.getenv("TELEGRAM_EMAIL_DOMAIN", "telegram.ethiolex.app")

# Reject logins whose signed auth_date is older than this (replay protection).
_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60  # 24 hours (Telegram's own recommendation)

# Fields Telegram signs. Anything outside this set is ignored when rebuilding the
# data-check-string so extra/spoofed keys cannot alter the verification.
_SIGNED_FIELDS = {"auth_date", "first_name", "id", "last_name", "photo_url", "username"}


class TelegramAuthError(Exception):
    """Raised for any expected failure (bad signature, misconfig, Supabase error)."""


# --------------------------------------------------------------------------- #
# 1. Verify the Telegram Login Widget signature
# --------------------------------------------------------------------------- #
def verify_login(data: dict) -> dict:
    """Verify a Telegram Login Widget payload; return the trusted fields.

    Follows https://core.telegram.org/widgets/login#checking-authorization :
      secret_key       = SHA256(bot_token)
      data_check_string = "\\n".join(sorted "key=value", excluding `hash`)
      expected_hash    = HMAC_SHA256(secret_key, data_check_string)
    Raises TelegramAuthError on any mismatch or staleness.
    """
    if not TELEGRAM_BOT_TOKEN:
        raise TelegramAuthError("Telegram login is not configured on the server.")

    received_hash = (data.get("hash") or "").strip()
    if not received_hash:
        raise TelegramAuthError("Missing Telegram authentication hash.")

    # Build the data-check-string from ONLY the fields Telegram signs, sorted by key.
    pairs = []
    for key in sorted(_SIGNED_FIELDS):
        if key in data and data[key] is not None:
            pairs.append(f"{key}={data[key]}")
    data_check_string = "\n".join(pairs)

    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    # Constant-time comparison so we never leak timing information about the hash.
    if not hmac.compare_digest(expected_hash, received_hash):
        raise TelegramAuthError("Invalid Telegram authentication signature.")

    # Freshness: the (now-trusted) auth_date must be recent.
    try:
        auth_date = int(data.get("auth_date", 0))
    except (TypeError, ValueError):
        raise TelegramAuthError("Invalid Telegram auth_date.")
    if auth_date <= 0 or (time.time() - auth_date) > _AUTH_MAX_AGE_SECONDS:
        raise TelegramAuthError("Telegram login has expired. Please try again.")

    telegram_id = data.get("id")
    if not telegram_id:
        raise TelegramAuthError("Telegram login is missing the user id.")

    return {
        "id": str(telegram_id),
        "first_name": data.get("first_name") or "",
        "last_name": data.get("last_name") or "",
        "username": data.get("username") or "",
        "photo_url": data.get("photo_url") or "",
    }


# --------------------------------------------------------------------------- #
# 2. Bridge the verified identity into a Supabase session
# --------------------------------------------------------------------------- #
def _admin_headers() -> dict:
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        raise TelegramAuthError("Supabase admin credentials are not configured.")
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _synthetic_email(telegram_id: str) -> str:
    return f"tg{telegram_id}@{TELEGRAM_EMAIL_DOMAIN}"


def _full_name(tg: dict) -> str:
    name = f"{tg['first_name']} {tg['last_name']}".strip()
    return name or (tg["username"] or f"Telegram {tg['id']}")


def _ensure_supabase_user(tg: dict, email: str) -> None:
    """Create the Supabase auth user for this Telegram account if it doesn't exist.

    Idempotent: an "already registered" response is treated as success. We still
    refresh the metadata on the create attempt so name/photo stay current for new
    users; existing users keep whatever they already have.
    """
    metadata = {
        "provider": "telegram",
        "telegram_id": tg["id"],
        "telegram_username": tg["username"],
        "full_name": _full_name(tg),
        "avatar_url": tg["photo_url"],
    }
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_admin_headers(),
        json={
            "email": email,
            "email_confirm": True,   # no confirmation mail; identity proven by Telegram
            "user_metadata": metadata,
        },
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return
    # 422 with an "already been registered" message just means the user exists.
    body = (resp.text or "").lower()
    if resp.status_code == 422 and ("already" in body or "registered" in body or "exists" in body):
        return
    raise TelegramAuthError(
        f"Could not provision the Telegram user (Supabase {resp.status_code})."
    )


def _generate_magic_token(email: str) -> str:
    """Mint a one-time magic-link token (token_hash) the client can verify."""
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/generate_link",
        headers=_admin_headers(),
        json={"type": "magiclink", "email": email},
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise TelegramAuthError(
            f"Could not start the Telegram session (Supabase {resp.status_code})."
        )
    payload = resp.json()
    # GoTrue returns the link fields either at the top level or under "properties",
    # depending on version — accept both.
    props = payload.get("properties") if isinstance(payload.get("properties"), dict) else payload
    token_hash = props.get("hashed_token")
    if not token_hash:
        raise TelegramAuthError("Supabase did not return a session token.")
    return token_hash


def issue_session_token(tg: dict) -> dict:
    """Ensure the Supabase user exists and return {email, token_hash} for the client.

    The client calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
    to exchange this single-use token for a real session.
    """
    email = _synthetic_email(tg["id"])
    _ensure_supabase_user(tg, email)
    token_hash = _generate_magic_token(email)
    return {"email": email, "token_hash": token_hash}
