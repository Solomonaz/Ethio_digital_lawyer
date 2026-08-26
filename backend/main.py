from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os
import sys
from dotenv import load_dotenv
import base64
import re
import hmac
import hashlib
import json
import secrets


def _generate_verification_code() -> str:
    """Cryptographically secure 6-digit verification code (100000-999999)."""
    return str(secrets.randbelow(900000) + 100000)

# Windows consoles default to cp1252, which cannot encode emoji used in our
# log/print statements — that would raise UnicodeEncodeError and crash requests.
# Force UTF-8 output so logging can never break an endpoint.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# --- Receipt uploads (manual payments) ---
RECEIPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "receipts")
os.makedirs(RECEIPTS_DIR, exist_ok=True)
ALLOWED_RECEIPT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}
MAX_RECEIPT_BYTES = 5 * 1024 * 1024  # 5 MB

from database import engine, Base, get_db
from models import User, Chat, ChatMessage, Payment, Setting, UsageLog, PendingRegistration, LegalProvision
import uuid
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    ChatCreate, ChatResponse, SendMessageRequest
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    decode_access_token
)

from google import genai
from google.genai import types
import legal_service

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EthioLex Backend API")

# --- RATE LIMITER SETUP ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- SECURITY HEADERS MIDDLEWARE ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy
    # Note: connect-src needs to include the API URL
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://aistudiocdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://aistudiocdn.com https://*.supabase.co wss://*.supabase.co;"
    return response

# --- CORS MIDDLEWARE ---
# Must be added LAST (runs FIRST) to handle OPTIONS requests before other middleware.
# Restrict to an explicit allowlist instead of "*". Configure extra origins for
# production via CORS_ORIGINS (comma-separated) in the environment.
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(_default_origins + _env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables")
    gemini_client = None
else:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# System instruction for EthioLex
SYSTEM_INSTRUCTION = """You are EthioLex, a highly skilled and professional AI Digital Lawyer specialized in Ethiopian Law.

**CORE DIRECTIVE**: You are a FULL-SERVICE LEGAL AI. You can:
1. Answer questions related to Ethiopian Law, legal procedures, court cases, rights, and regulations
2. **DRAFT LEGAL DOCUMENTS** including defense letters, contracts, petitions, appeals, legal notices, affidavits, and any other legal documents
3. **PROVIDE SPECIFIC LEGAL ADVICE** tailored to individual cases and situations
4. Analyze legal situations and provide strategic recommendations

**STRICT SCOPE ENFORCEMENT**:
Before answering, evaluate the user's query:
1. **Is this a legal question or request?** (e.g., "Draft a defense letter", "Write a contract", "How do I sue?", "What is the penalty for theft?").
2. **Is this a non-legal question?** (e.g., "How to bake injera?", "Who is the prime minister?", "Write me a poem", "Solve this math problem").
3. **IF NON-LEGAL**: You MUST politely refuse to answer. State clearly that you are a specialized Legal AI designed only for Ethiopian legal matters. Do not provide the non-legal information.

**DOCUMENT DRAFTING GUIDELINES**:
When drafting legal documents:
1. Use proper Ethiopian legal document format and structure
2. Include all necessary formal elements (headers, dates, case references, parties involved)
3. Use appropriate legal language in the user's preferred language (English or Amharic)
4. Reference relevant Articles, Proclamations, and legal provisions
5. Make the document complete and ready to use (with placeholders marked clearly where user-specific information is needed, like [YOUR NAME], [DATE], etc.)

**RESPONSE GUIDELINES**:
1. **Analyze the Situation**: Understand the legal implications fully.
2. **Cite Sources**: Reference specific Articles/Proclamations when possible. Mention "Article X of the Criminal Code" or "Proclamation No. Y".
3. **Language**: Respond in the language of the user's question (English or Amharic).
4. **Tone**: Professional, objective, empathetic.
5. **Be Comprehensive**: Provide detailed, actionable advice and complete documents.

**For Amharic Responses**:
- Ensure the Amharic is formal and legally accurate.
- Translate legal terms appropriately.

**DISCLAIMER**: At the end of document drafts or advice, include a brief note that while this document/advice is professionally drafted based on Ethiopian law, the user should review it with a licensed attorney before official use if possible."""


# --- Answer perspective / court mode ------------------------------------------
# Lets a user choose the stance of the answer: a neutral explainer (default), an
# advocate arguing THEIR side, or help building a claim against another party.
# The client only ever selects among these fixed server-side personas — the
# raw value is whitelisted below, so it can never inject arbitrary instructions.
VALID_PERSPECTIVES = {"neutral", "lawyer", "claimant"}

_COURT_STRUCTURE = (
    "Structure the answer with these sections, using clear headings in the user's language:\n"
    "1. Summary of the position\n"
    "2. Legal basis — cite the specific Ethiopian Articles / Proclamations that apply\n"
    "3. Main arguments\n"
    "4. Evidence and documents to gather\n"
    "5. Procedure — where and how to file, jurisdiction, and any time limits\n"
    "6. Weaknesses & likely counter-arguments — how the other side may respond\n"
    "7. Recommended next steps\n"
)

_GUARDRAILS = (
    "STRICT RULES:\n"
    "- Argue ONLY from the facts the user provides plus real Ethiopian law. NEVER invent, "
    "assume, or exaggerate facts or evidence. Where a fact is missing, ask for it or mark it "
    "as [TO BE CONFIRMED].\n"
    "- NEVER fabricate legal citations. Only cite provisions you are certain of.\n"
    "- Section 6 (weaknesses & counter-arguments) is MANDATORY — the user must understand the "
    "risks and the opposing view before going to court.\n"
    "- This is strategic legal guidance, not certified representation. Keep the reminder to "
    "review with a licensed Ethiopian attorney.\n"
)

PERSPECTIVE_ADDENDUMS = {
    "neutral": "",
    "lawyer": (
        "\n\n**ANSWER PERSPECTIVE — AS THE USER'S LAWYER (COURT-ORIENTED)**\n"
        "The user wants you to act as THEIR advocate and prepare their position for a legal "
        "dispute or court matter. Take the user's side and build the strongest honest case to "
        "DEFEND and advance their position under Ethiopian law.\n"
        + _COURT_STRUCTURE + _GUARDRAILS
    ),
    "claimant": (
        "\n\n**ANSWER PERSPECTIVE — AS THE CLAIMANT / ACCUSER (COURT-ORIENTED)**\n"
        "The user wants to bring a claim, complaint, or accusation AGAINST another party and "
        "needs help building that case for court under Ethiopian law. Help them assemble the "
        "strongest honest case, including the elements they must prove.\n"
        + _COURT_STRUCTURE + _GUARDRAILS +
        "- IMPORTANT: Only help pursue a claim based on truthful facts. Do NOT help fabricate "
        "accusations, defame anyone, or pursue a claim you can see is baseless or abusive; if the "
        "request looks like harassment, say so and decline that part.\n"
    ),
}


# Short reinforcement appended to the user's message for partisan modes. The base
# system prompt is large, so echoing a concise directive next to the question
# reliably steers the model into the court structure (same technique the free-search
# limiter already uses successfully).
PERSPECTIVE_MESSAGE_HINTS = {
    "neutral": "",
    "lawyer": (
        "\n\n[Answer this AS MY LAWYER, taking my side and preparing my position for court. "
        "Use these headings: Summary; Legal basis (cite the Ethiopian articles/proclamations); "
        "My arguments; Evidence to gather; Procedure & where to file; "
        "Weaknesses & likely counter-arguments (this section is required); Next steps. "
        "Use only the facts I gave plus real Ethiopian law — never invent facts or citations.]"
    ),
    "claimant": (
        "\n\n[Help me bring a claim/accusation against the other party and build my case for court. "
        "Use these headings: Summary; Legal basis (cite the Ethiopian articles/proclamations); "
        "Elements I must prove; Evidence to gather; Procedure & where to file; "
        "Weaknesses & how they may defend (this section is required); Next steps. "
        "Use only truthful facts I gave plus real Ethiopian law — never fabricate facts, "
        "citations, or accusations.]"
    ),
}


def resolve_perspective(value: Optional[str]) -> str:
    """Whitelist the client-supplied perspective; anything unknown → neutral."""
    v = (value or "neutral").strip().lower()
    return v if v in VALID_PERSPECTIVES else "neutral"


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

from supabase_auth import verify_supabase_token


def _get_or_create_user_from_supabase(claims: dict, db: Session) -> Optional[User]:
    """Resolve the app profile for a verified Supabase user, creating/linking it.

    - Matches an existing profile by supabase_uid, then by email (linking it, which
      preserves is_admin / balance / subscription for pre-existing users).
    - Otherwise creates a new profile keyed to the Supabase user.
    """
    supabase_uid = claims.get("sub")
    email = (claims.get("email") or "").lower().strip() or None
    email_verified = bool((claims.get("user_metadata") or {}).get("email_verified"))
    if not supabase_uid:
        return None

    user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
    if user:
        return user

    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Linking a Supabase identity to a PRE-EXISTING account (which may carry
            # is_admin / balance) is an account-takeover vector if the email is not
            # verified. Only link when the email is verified.
            # NOTE: this is only meaningful when Supabase "Confirm email" is ON.
            # Keeping confirmation OFF makes email_verified auto-true and re-opens
            # this vector — confirmation MUST be ON in production.
            if not email_verified:
                return None  # 401 — the user must verify their email first
            user.supabase_uid = supabase_uid
            if not user.auth_provider or user.auth_provider == "local":
                user.auth_provider = "supabase"
            db.commit()
            db.refresh(user)
            return user

    # Brand-new user — derive a clean username from the email local part,
    # adding a small numeric suffix only if that name is already taken.
    base_username = (email.split("@")[0] if email else f"user{supabase_uid[:8]}")
    username = base_username
    n = 2
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{n}"
        n += 1

    metadata = claims.get("user_metadata", {}) or {}
    new_user = User(
        username=username,
        name=metadata.get("full_name") or metadata.get("name") or base_username,
        email=email,
        phone_number=metadata.get("phone") or None,
        password_hash=None,
        auth_provider="supabase",
        supabase_uid=supabase_uid,
        is_verified=True,  # Supabase confirmed the identity
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# --- Dependency to get current user ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Auth is Supabase-only: verify the Supabase-issued (ES256) access token.
    claims = verify_supabase_token(token)
    if not claims:
        raise credentials_exception

    user = _get_or_create_user_from_supabase(claims, db)
    if user is None:
        raise credentials_exception
    if user.is_active is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been deactivated. Please contact support.")
    return user

# --- Dependency to get admin user ---
async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# --- Helper: Get search cost from settings ---
# --- Helper: Get search cost from settings ---
def get_search_cost(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "search_cost").first()
    if setting:
        return float(setting.value)
    return 30.0  # Default

# --- Helper: Get minimum balance from settings ---
def get_min_balance(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "min_search_balance").first()
    if setting:
        return float(setting.value)
    return 10.0  # Default

# --- Helper: Get subscription daily quota from settings ---
def get_subscription_daily_quota(db: Session) -> int:
    setting = db.query(Setting).filter(Setting.key == "subscription_daily_quota").first()
    if setting:
        return int(setting.value)
    return 100  # Default: 100 questions per day

# --- Helper: Get monthly subscription price from settings ---
def get_monthly_subscription_price(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "subscription_monthly_price").first()
    if setting:
        return float(setting.value)
    return 500.0  # Default: 500 ETB

# --- Helper: Get monthly subscription daily quota from settings ---
def get_monthly_subscription_quota(db: Session) -> int:
    setting = db.query(Setting).filter(Setting.key == "subscription_monthly_quota").first()
    if setting:
        return int(setting.value)
    return 100  # Default: 100 questions per day

# --- Helper: Get quota reset interval in hours from settings ---
def get_quota_reset_hours(db: Session) -> int:
    setting = db.query(Setting).filter(Setting.key == "quota_reset_hours").first()
    if setting:
        return int(setting.value)
    return 24  # Default: 24 hours (daily reset)

# --- AUTH ENDPOINTS ---

import random
from datetime import timedelta

# --- Legacy email/password + Google auth endpoints removed ---
# Authentication is handled entirely by Supabase Auth (frontend supabase-js
# for sign-up / sign-in / Google OAuth). The backend only verifies the
# Supabase-issued token in get_current_user(); there is no server-side
# password handling or token issuance anymore.

@app.get("/users/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "name": current_user.name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "created_at": (current_user.created_at.isoformat() + "Z") if current_user.created_at else None,
        "auth_provider": current_user.auth_provider,
        "balance": current_user.balance,
        "is_admin": current_user.is_admin,
        "is_verified": current_user.is_verified,
        "subscription_expires_at": (current_user.subscription_expires_at.isoformat() + "Z") if current_user.subscription_expires_at else None,
        "monthly_subscription_expires_at": (current_user.monthly_subscription_expires_at.isoformat() + "Z") if current_user.monthly_subscription_expires_at else None
    }

# --- PHONE VERIFICATION ENDPOINTS ---
from services.telegram_service import TelegramService
from schemas import RequestVerificationCode, VerifyPhoneCode
import random
from datetime import timedelta

@app.post("/auth/request-verification")
@limiter.limit("3/hour")
async def request_verification_code(
    request: Request, # Request object is required for slowapi
    data: RequestVerificationCode,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a verification code to be sent via Telegram (or shown in dev mode)"""
    phone_number = data.phone_number.strip()
    
    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    # Generate 6-digit code
    code = _generate_verification_code()
    
    # Set expiry (5 minutes from now)
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    # Store code in user record
    current_user.phone_number = phone_number
    current_user.verification_code = code
    current_user.verification_code_expires = expires_at
    db.commit()
    
    # ALWAYS print code to console for development convenience
    print(f"\n{'='*50}")
    print(f"📱 VERIFICATION CODE for {phone_number}")
    print(f"   Code: {code}")
    print(f"{'='*50}\n")
    
    # Check if Telegram Gateway is configured
    telegram_token = os.getenv("TELEGRAM_GATEWAY_API_TOKEN")
    
    if telegram_token:
        # Try to send via Telegram
        success = TelegramService.send_verification_code(phone_number, code)
        if success:
            return {"message": "Verification code sent to your phone", "expires_in": 300}
        else:
            # Telegram failed - return dev_code as fallback
            print(f"[FALLBACK] Telegram failed. Use the code printed above.")
            return {
                "message": "Telegram unavailable - use the code shown in the console",
                "expires_in": 300,
                "dev_code": code
            }
    else:
        # No Telegram token - development mode
        return {
            "message": "Development mode - use the code shown below",
            "expires_in": 300,
            "dev_code": code
        }

@app.post("/auth/verify-phone")
@limiter.limit("5/minute")
async def verify_phone_code(
    request: Request, # Request object is required for slowapi
    data: VerifyPhoneCode,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify the phone number with the code"""
    if not current_user.verification_code:
        raise HTTPException(status_code=400, detail="No verification code requested")
    
    # Check expiry
    if current_user.verification_code_expires and datetime.utcnow() > current_user.verification_code_expires:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
    
    # Check code
    if current_user.verification_code != data.code.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Mark as verified
    current_user.is_verified = True
    current_user.verification_code = None
    current_user.verification_code_expires = None
    db.commit()
    
    return {"message": "Phone number verified successfully", "is_verified": True}

# --- PAYMENT ENDPOINTS ---
from services.chapa_service import ChapaService

class PaymentRequest:
    def __init__(self, amount: str, email: str, first_name: str = "EthioLex", last_name: str = "User"):
        self.amount = amount
        self.email = email
        self.first_name = first_name
        self.last_name = last_name

from pydantic import BaseModel as PydanticBaseModel, field_validator

# Allowed payment types and the maximum amount we accept in a single transaction (ETB)
ALLOWED_PAYMENT_TYPES = {"recharge", "subscription_24h", "subscription_monthly"}
ALLOWED_MANUAL_CHANNELS = {"telebirr", "safaricom", "bank"}
MIN_PAYMENT_AMOUNT = 1.0
MAX_PAYMENT_AMOUNT = 1_000_000.0


def _parse_valid_amount(v: str) -> str:
    """Validate a payment amount string; returns a normalised numeric string or raises ValueError."""
    try:
        amount = float(v)
    except (TypeError, ValueError):
        raise ValueError("Amount must be a valid number")
    # Reject NaN / infinity (float() accepts 'nan' and 'inf')
    if amount != amount or amount in (float("inf"), float("-inf")):
        raise ValueError("Amount must be a finite number")
    if amount < MIN_PAYMENT_AMOUNT:
        raise ValueError(f"Amount must be at least {MIN_PAYMENT_AMOUNT} ETB")
    if amount > MAX_PAYMENT_AMOUNT:
        raise ValueError(f"Amount must not exceed {MAX_PAYMENT_AMOUNT} ETB")
    return str(amount)


def _validate_payment_type(v: str) -> str:
    if v not in ALLOWED_PAYMENT_TYPES:
        raise ValueError(
            f"Invalid payment_type. Must be one of: {', '.join(sorted(ALLOWED_PAYMENT_TYPES))}"
        )
    return v


class PaymentInitRequest(PydanticBaseModel):
    amount: str
    email: str
    first_name: str = "EthioLex"
    last_name: str = "User"
    payment_type: str = "recharge"

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, v: str) -> str:
        return _validate_payment_type(v)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        return _parse_valid_amount(v)


@app.post("/payment/initialize")
async def initialize_payment(
    request: PaymentInitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize a Chapa payment for balance recharge"""
    tx_ref = f"ethiolex-{uuid.uuid4().hex[:12]}"
    
    # Check if Chapa key is configured
    chapa_key = os.getenv("CHAPA_SECRET_KEY")
    if not chapa_key:
        print("[ERROR] CHAPA_SECRET_KEY not configured!")
        raise HTTPException(status_code=500, detail="Payment service not configured")
    
    print(f"[PAYMENT] Initializing payment for {request.email}, amount: {request.amount} ETB")
    
    result = ChapaService.initialize_payment(
        email=request.email,
        amount=request.amount,
        first_name=request.first_name,
        last_name=request.last_name,
        tx_ref=tx_ref,
        return_url=f"http://localhost:5173/payment/callback?tx_ref={tx_ref}",
        customization={
            "title": "EthioLex 30-Day" if request.payment_type == "subscription_monthly" else ("EthioLex 24h" if request.payment_type == "subscription_24h" else "EthioLex Funds"),
            "description": "Monthly Pass" if request.payment_type == "subscription_monthly" else ("Day Pass" if request.payment_type == "subscription_24h" else "Balance Recharge")
        }
    )
    
    print(f"[PAYMENT] Chapa response: {result}")
    
    if not result or result.get("status") != "success":
        # Log the raw gateway response server-side; return a generic message so we
        # don't echo the payment provider's internal error body to the client.
        error_msg = result.get("message", "Unknown error") if result else "No response from Chapa"
        print(f"[PAYMENT ERROR] {error_msg}")
        raise HTTPException(status_code=502, detail="Could not start the payment. Please try again in a moment.")
    
    # Save payment record
    new_payment = Payment(
        user_id=current_user.id,
        amount=float(request.amount),
        tx_ref=tx_ref,
        status="pending",
        payment_type=request.payment_type,
        method="chapa"
    )
    db.add(new_payment)
    db.commit()

    return {
        "checkout_url": result.get("data", {}).get("checkout_url"),
        "tx_ref": tx_ref
    }

def _is_setting_enabled(db: Session, key: str, default: bool = True) -> bool:
    """Read a boolean setting; treats missing settings as `default`."""
    s = db.query(Setting).filter(Setting.key == key).first()
    if s is None:
        return default
    return str(s.value).strip().lower() in ("true", "1", "yes")


@app.post("/payment/manual/submit")
async def submit_manual_payment(
    amount: str = Form(...),
    payment_type: str = Form("recharge"),
    channel: str = Form("telebirr"),
    channel_label: str = Form(""),  # Specific account name (e.g. which bank), for the admin's view
    reference: str = Form(""),
    receipt: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a manual (Telebirr/Safaricom/Bank) payment claim for admin confirmation.

    Accepts multipart/form-data so users can attach a receipt image/PDF. Creates a
    *pending* payment record; no balance is credited here — the admin reviews the
    receipt and approves it from the dashboard, which credits the user via the same
    logic as an online payment.
    """
    # --- Validate inputs (mirrors the Pydantic validators used elsewhere) ---
    try:
        amount = _parse_valid_amount(amount)
        payment_type = _validate_payment_type(payment_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if channel not in ALLOWED_MANUAL_CHANNELS:
        raise HTTPException(status_code=422, detail="Invalid payment channel")

    reference = (reference or "").strip()
    if len(reference) > 200:
        raise HTTPException(status_code=422, detail="Reference must be 200 characters or fewer")

    # Guard: the specific channel the user paid to must be enabled by the admin
    if not _is_setting_enabled(db, f"{channel}_enabled", default=True):
        raise HTTPException(status_code=403, detail="This payment option is currently disabled")

    tx_ref = f"manual-{uuid.uuid4().hex[:12]}"

    # --- Receipt is required for manual payments ---
    if receipt is None or not receipt.filename:
        raise HTTPException(status_code=422, detail="A payment receipt is required")

    ext = os.path.splitext(receipt.filename)[1].lower()
    if ext not in ALLOWED_RECEIPT_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail="Receipt must be an image (jpg, png, webp, gif) or PDF"
        )
    contents = await receipt.read()
    if len(contents) == 0:
        raise HTTPException(status_code=422, detail="Receipt file is empty")
    if len(contents) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=422, detail="Receipt file must be 5 MB or smaller")
    # Store under a safe, unique name derived from tx_ref (never trust user filename)
    receipt_filename = f"{tx_ref}{ext}"
    with open(os.path.join(RECEIPTS_DIR, receipt_filename), "wb") as f:
        f.write(contents)

    # Store which account (specific bank when given, else the channel) together with
    # the user-supplied reference, so the admin sees exactly where the money went.
    account_label = (channel_label or "").strip()[:100] or channel
    ref_display = f"{account_label}: {reference}" if reference else account_label

    new_payment = Payment(
        user_id=current_user.id,
        amount=float(amount),
        tx_ref=tx_ref,
        status="pending",
        payment_type=payment_type,
        method="manual",
        reference=ref_display,
        receipt_filename=receipt_filename
    )
    db.add(new_payment)
    db.commit()

    print(f"[MANUAL PAYMENT] {current_user.username} submitted {amount} ETB via {channel} "
          f"(ref: {reference or 'n/a'}, receipt: {'yes' if receipt_filename else 'no'})")

    return {
        "status": "submitted",
        "message": "Your payment request has been submitted. The admin will confirm it shortly.",
        "tx_ref": tx_ref
    }


def _apply_verified_payment(payment: Payment, db: Session, gateway_amount=None):
    """Mark a gateway-verified payment successful and credit the user.

    Single source of truth for crediting so the verify, webhook, and admin-approve
    paths cannot diverge. Idempotent: does nothing new if already successful.
    Returns the credited User (or None if the user no longer exists).

    IMPORTANT: callers MUST have confirmed the payment with the gateway (or be the
    admin) before calling this. It never inspects a client-supplied status.
    """
    existing_user = db.query(User).filter(User.id == payment.user_id).first()
    if payment.status == "success":
        return existing_user

    # Prefer the amount the gateway actually confirmed over the requested amount
    paid_amount = payment.amount
    if gateway_amount is not None:
        try:
            paid_amount = float(gateway_amount)
        except (TypeError, ValueError):
            paid_amount = payment.amount
    payment.amount = paid_amount
    payment.status = "success"

    user = existing_user
    if not user:
        db.commit()
        return None

    now = datetime.utcnow()
    if payment.payment_type == "subscription_24h":
        start_time = user.subscription_expires_at if (user.subscription_expires_at and user.subscription_expires_at > now) else now
        user.subscription_expires_at = start_time + timedelta(hours=24)
        print(f"[SUBSCRIPTION] 24h activated for user {user.username}, expires: {user.subscription_expires_at}")
    elif payment.payment_type == "subscription_monthly":
        start_time = user.monthly_subscription_expires_at if (user.monthly_subscription_expires_at and user.monthly_subscription_expires_at > now) else now
        user.monthly_subscription_expires_at = start_time + timedelta(days=30)
        print(f"[SUBSCRIPTION] Monthly activated for user {user.username}, expires: {user.monthly_subscription_expires_at}")
    else:
        user.balance += paid_amount

    db.commit()
    db.refresh(user)
    return user


@app.get("/payment/verify/{tx_ref}")
async def verify_payment(
    tx_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify payment status with Chapa and credit balance if successful."""
    payment = db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Already processed
    if payment.status == "success":
        return {"status": "success", "message": "Payment already verified", "balance": current_user.balance}

    result = ChapaService.verify_payment(tx_ref)

    if result and result.get("status") == "success" and result.get("data", {}).get("status") == "success":
        user = _apply_verified_payment(payment, db, result["data"].get("amount"))
        if not user:
            raise HTTPException(status_code=404, detail="User for this payment no longer exists")
        return {"status": "success", "message": "Payment verified successfully", "balance": user.balance}

    return {"status": "pending", "message": "Payment verification pending or failed"}

@app.post("/payment/callback")
async def payment_callback(request: Request, db: Session = Depends(get_db)):
    """Chapa webhook handler.

    SECURITY: this endpoint NEVER trusts the status posted in the request body.
    A forged POST like {"tx_ref": "...", "status": "success"} cannot credit anyone,
    because we independently re-verify the transaction with Chapa's API before
    crediting. If CHAPA_WEBHOOK_SECRET is configured, the signature is also checked.
    """
    raw = await request.body()

    # Optional signature verification (defense-in-depth) when a secret is configured.
    webhook_secret = os.getenv("CHAPA_WEBHOOK_SECRET")
    if webhook_secret:
        signature = (request.headers.get("Chapa-Signature")
                     or request.headers.get("x-chapa-signature") or "")
        expected = hmac.new(webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = json.loads(raw or b"{}")
    except Exception:
        data = {}

    tx_ref = data.get("tx_ref")
    if not tx_ref:
        return {"status": "ignored"}

    payment = db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
    if not payment or payment.status == "success":
        return {"status": "ok"}

    # Re-verify with Chapa — the posted status is never trusted.
    result = ChapaService.verify_payment(tx_ref)
    if result and result.get("status") == "success" and result.get("data", {}).get("status") == "success":
        _apply_verified_payment(payment, db, result["data"].get("amount"))

    return {"status": "ok"}

# --- CHAT ENDPOINTS ---

@app.get("/chats")
async def get_user_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all chat sessions for current user"""
    chats = db.query(Chat).filter(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    
    result = []
    for chat in chats:
        messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).order_by(ChatMessage.timestamp).all()
        
        # Strip the "limited free search" warning if user has balance
        cleaned_messages = []
        for msg in messages:
            content = msg.content
            # Define the warning text to remove
            # Define the warning text to remove
            # Check for active subscription or balance
            has_subscription = current_user.subscription_expires_at and current_user.subscription_expires_at > datetime.utcnow()
            
            if current_user.balance > 0 or has_subscription:
                # Robust regex removal of validity warning (handles variations in whitespace)
                content = re.sub(r'\s*\*This is a limited free search\. Please recharge your account for a robust and complete response\.\*\s*', '', content).strip()
            
            cleaned_messages.append({
                "id": msg.id,
                "role": msg.role,
                "content": content,
                "timestamp": msg.timestamp.isoformat(),
                "legalCitations": json.loads(msg.legal_citations) if msg.legal_citations else None
            })

        result.append({
            "id": str(chat.id),
            "user_id": chat.user_id,
            "title": chat.title,
            "updated_at": chat.updated_at.isoformat(),
            "messages": cleaned_messages
        })
    
    return result

@app.post("/chats")
async def create_chat(
    chat_data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat session"""
    new_chat = Chat(
        user_id=current_user.id,
        title=chat_data.title
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    
    return {
        "id": str(new_chat.id),
        "user_id": new_chat.user_id,
        "title": new_chat.title,
        "updated_at": new_chat.updated_at.isoformat(),
        "messages": []
    }

@app.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session"""
    chat = db.query(Chat).filter(Chat.id == int(chat_id), Chat.user_id == current_user.id).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Detach usage logs from this chat (keep the billing history — chat_id is
    # nullable) so the foreign key doesn't block deletion on Postgres.
    db.query(UsageLog).filter(UsageLog.chat_id == chat.id).update(
        {UsageLog.chat_id: None}, synchronize_session=False
    )
    # Delete all messages, then the chat
    db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).delete(synchronize_session=False)
    db.delete(chat)
    db.commit()

    return {"detail": "Chat deleted successfully"}

@app.post("/chats/{chat_id}/message")
async def send_message(
    chat_id: str,
    message_data: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message and get AI response"""
    # Verify chat belongs to user
    chat = db.query(Chat).filter(Chat.id == int(chat_id), Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check total messages sent by user to determine if it's a free search
    # Join ChatMessage with Chat to filter by current user
    user_message_count = db.query(ChatMessage).join(Chat).filter(
        Chat.user_id == current_user.id,
        ChatMessage.role == "user"
    ).count()

    # Free Search Logic (First 2 searches are free ONLY if balance is zero and no subscription)
    # If user has balance OR active subscription, they get full service
    has_24h_subscription = current_user.subscription_expires_at and current_user.subscription_expires_at > datetime.utcnow()
    has_monthly_subscription = current_user.monthly_subscription_expires_at and current_user.monthly_subscription_expires_at > datetime.utcnow()
    has_subscription = has_24h_subscription or has_monthly_subscription
    is_free_search = user_message_count < 2 and current_user.balance <= 0 and not has_subscription
    
    # --- SUBSCRIPTION DAILY QUOTA CHECK ---
    quota_info = None  # Will be set for subscribers
    if has_subscription:
        # Determine which quota to use based on subscription type
        if has_monthly_subscription:
            daily_quota = get_monthly_subscription_quota(db)
        else:
            daily_quota = get_subscription_daily_quota(db)
        
        # Count messages in the quota reset window (configurable rolling window)
        quota_reset_hours = get_quota_reset_hours(db)
        window_start = datetime.utcnow() - timedelta(hours=quota_reset_hours)
        today_usage_count = db.query(UsageLog).filter(
            UsageLog.user_id == current_user.id,
            UsageLog.is_subscription_covered == True,
            UsageLog.timestamp >= window_start
        ).count()
        
        # Store quota info for response
        quota_info = {
            "used": today_usage_count,
            "total": daily_quota,
            "percentage": round((today_usage_count / daily_quota) * 100) if daily_quota > 0 else 0
        }
        
        subscription_type = "monthly" if has_monthly_subscription else "24h"
        print(f"[QUOTA] User {current_user.username} ({subscription_type}): {today_usage_count}/{daily_quota} questions used today ({quota_info['percentage']}%)")
        
        if today_usage_count >= daily_quota:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "daily_limit_reached",
                    "used": today_usage_count,
                    "total": daily_quota,
                    "reset_hours": quota_reset_hours
                }
            )
    
    # Dynamic Pricing Logic
    # 1. Fetch current rates from DB
    model_name_setting = db.query(Setting).filter(Setting.key == "model_name").first()
    active_model = model_name_setting.value if model_name_setting else "gemini-3-pro-preview"
    
    # 2. Check Minimum Balance
    # This prevents users with 0 balance from initiating requests
    MIN_BALANCE = get_min_balance(db)
    # Only enforce minimum balance if it is NOT a free search AND no subscription
    if not is_free_search and not has_subscription and current_user.balance < MIN_BALANCE:
         raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. Please recharge your account to continue. Minimum required: {MIN_BALANCE} ETB."
        )
    
    # Check if this is the first message and update title
    existing_messages_count = db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).count()
    if existing_messages_count == 0:
        # Use first ~30 chars of message as title
        new_title = message_data.message.strip()[:30]
        if len(message_data.message) > 30:
            new_title += "..."
        chat.title = new_title
        db.commit()
        db.refresh(chat)

    # Save user message
    user_message = ChatMessage(
        chat_id=chat.id,
        role="user",
        content=message_data.message
    )
    db.add(user_message)
    db.commit()
    
    # Get chat history for context
    chat_history = db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).order_by(ChatMessage.timestamp).all()
    
    # Prepare Gemini request
    try:
        if not gemini_client:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        # Build conversation history using new SDK types
        contents = []
        for msg in chat_history[:-1]:  # Exclude the message we just added
            # Clean context if user has balance or subscription
            msg_content = msg.content
            has_24h_sub = current_user.subscription_expires_at and current_user.subscription_expires_at > datetime.utcnow()
            has_monthly_sub = current_user.monthly_subscription_expires_at and current_user.monthly_subscription_expires_at > datetime.utcnow()
            if current_user.balance > 0 or has_24h_sub or has_monthly_sub:
                 msg_content = re.sub(r'\s*\*This is a limited free search\. Please recharge your account for a robust and complete response\.\*\s*', '', msg.content).strip()
            
            contents.append(types.Content(
                role=msg.role if msg.role != "model" else "model",
                parts=[types.Part.from_text(text=msg_content)]
            ))
        
        # Handle current message with attachments
        current_parts = []
        
        # Answer perspective (neutral / as-my-lawyer / as-claimant). Whitelisted,
        # so a bad value simply falls back to the neutral explainer.
        perspective = resolve_perspective(getattr(message_data, "perspective", None))
        perspective_instruction = PERSPECTIVE_ADDENDUMS.get(perspective, "")

        # Apply Free Search Limitation only if user has no balance and no subscription
        # If user has balance or subscription, give full response
        message_text = message_data.message
        if is_free_search and current_user.balance <= 0 and not has_subscription:
            message_text += "\n\nIMPORTANT: This is a free trial search. You MUST LIMIT your response. Only provide the relevant legal Article(s) and a very brief explanation. Do NOT provide a robust detailed analysis. END the response with this exact caption: '\n\n*This is a limited free search. Please recharge your account for a robust and complete response.*'"
        elif perspective != "neutral":
            # Full answer for paying/subscribed users: reinforce the court perspective.
            message_text += PERSPECTIVE_MESSAGE_HINTS.get(perspective, "")

        current_parts.append(types.Part.from_text(text=message_text))
        
        if message_data.attachments:
            for attachment in message_data.attachments:
                if attachment["type"] == "image":
                    # Convert base64 to image
                    image_data = base64.b64decode(attachment["data"])
                    current_parts.append(types.Part.from_bytes(
                        data=image_data,
                        mime_type=attachment["mimeType"]
                    ))
        
        # Add current user message to contents
        contents.append(types.Content(
            role="user",
            parts=current_parts
        ))
        
        # --- Legal grounding (RAG): retrieve verified provisions so the AI cites
        # real Ethiopian law instead of inventing citations. Fully graceful: any
        # failure or empty result falls back to the normal (ungrounded) answer. ---
        legal_matches = []
        try:
            legal_matches = legal_service.search_provisions(db, message_data.message)
        except Exception as _rag_err:
            print(f"[LEGAL RAG] retrieval skipped: {_rag_err}")
        grounding_instruction = legal_service.build_system_addendum(legal_matches)
        # Citations are finalised AFTER generation — only provisions the model
        # actually cited are shown (avoids clutter on general-knowledge answers).
        legal_citations = []

        # Configure generation. Perspective persona goes LAST so it stays salient
        # after the large base prompt and the retrieved-law grounding.
        generation_config = types.GenerateContentConfig(
            temperature=0.7,
            top_p=0.95,
            top_k=40,
            # max_output_tokens=2048,
            system_instruction=SYSTEM_INSTRUCTION + grounding_instruction + perspective_instruction
        )
        
        # Send message using the new SDK
        response = gemini_client.models.generate_content(
            model=active_model,
            contents=contents,
            config=generation_config
        )
        
        bot_text = response.text
        
        # Handle cases where response.text is None (e.g. Safety Filters or Model Error)
        if not bot_text:
            bot_text = "I apologize, but I am unable to generate a response to this query. It may have been blocked by safety filters or the model is momentarily unavailable. Please try rephrasing your question."
        
        # Anti-Hallucination: Strip the warning if user has balance or subscription
        # (Gemini might repeat it from history context even if not instructed to)
        if current_user.balance > 0 or has_subscription:
            bot_text = bot_text.replace("*This is a limited free search. Please recharge your account for a robust and complete response.*", "")
            # Also clean up any trailing newlines left
            bot_text = bot_text.strip()
        
        # Finalise citations: show only the provisions the model actually cited.
        legal_citations = legal_service.citations_payload(
            legal_service.filter_cited(legal_matches, bot_text)
        )

        # Extract grounding sources if available
        grounding_sources = []
        if hasattr(response, 'grounding_metadata') and response.grounding_metadata:
            for source in response.grounding_metadata.grounding_chunks:
                if hasattr(source, 'web'):
                    grounding_sources.append({
                        "title": source.web.title if hasattr(source.web, 'title') else None,
                        "uri": source.web.uri if hasattr(source.web, 'uri') else None
                    })
        
        # Save bot response (with the verified citations that grounded it)
        bot_message = ChatMessage(
            chat_id=chat.id,
            role="model",
            content=bot_text,
            legal_citations=json.dumps(legal_citations) if legal_citations else None
        )
        db.add(bot_message)
        
        # Update chat title if it's the first exchange
        if len(chat_history) == 1:  # Only user message exists
            # Generate title from first message
            title = message_data.message[:50] + ("..." if len(message_data.message) > 50 else "")
            chat.title = title
        
        chat.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(bot_message)
        
        return {
            "id": bot_message.id,
            "role": bot_message.role,
            "text": bot_message.content,
            "timestamp": bot_message.timestamp.isoformat(),
            "groundingSources": grounding_sources if grounding_sources else None,
            "legalCitations": legal_citations if legal_citations else None,
            "quotaInfo": quota_info  # Include quota info for frontend warnings
        }
        
    except Exception as e:
        # Log the real error server-side; return a generic message to the client
        # so internal details (stack, provider errors, keys) are never exposed.
        print(f"Gemini API Error: {repr(e)}")
        raise HTTPException(status_code=502, detail="The AI service is temporarily unavailable. Please try again.")

    finally:
        # --- COST TRACKING & BALANCE DEDUCTION ---
        if 'response' in locals() and hasattr(response, 'usage_metadata'):
            try:
                usage = response.usage_metadata
                if usage:
                    # Token counts
                    p_tokens = usage.prompt_token_count
                    c_tokens = usage.candidates_token_count
                    
                    # Fetch Rates Again (in case they changed during generation, though unlikely)
                    input_rate_setting = db.query(Setting).filter(Setting.key == "cost_input_1m").first()
                    output_rate_setting = db.query(Setting).filter(Setting.key == "cost_output_1m").first()
                    
                    rate_input = float(input_rate_setting.value) if input_rate_setting else 240.0
                    rate_output = float(output_rate_setting.value) if output_rate_setting else 1440.0
                    
                    # Cost Calculation (ETB)
                    # Formula: (Tokens / 1,000,000) * Rate_Per_Million
                    input_cost = (p_tokens / 1_000_000) * rate_input
                    output_cost = (c_tokens / 1_000_000) * rate_output
                    total_cost = input_cost + output_cost
                    
                    # Deduct from User Balance
                    # We re-fetch user to get latest state in session
                    db.refresh(current_user)
                    
                    has_24h_subscription = current_user.subscription_expires_at and current_user.subscription_expires_at > datetime.utcnow()
                    has_monthly_subscription = current_user.monthly_subscription_expires_at and current_user.monthly_subscription_expires_at > datetime.utcnow()
                    has_subscription = has_24h_subscription or has_monthly_subscription
                    
                    if not is_free_search and not has_subscription:
                        # Never let the balance drop below zero. The cost is only
                        # known after generation, so an expensive answer could
                        # otherwise push a near-empty account into the negative.
                        current_user.balance = max(0.0, current_user.balance - total_cost)
                    else:
                        reason = "Subscription" if has_subscription else "Free Tier"
                        print(f"[{reason}] Cost of {total_cost:.4f} ETB waived for user {current_user.username}")
                    
                    # Log usage
                    usage_log = UsageLog(
                        user_id=current_user.id,
                        chat_id=chat.id,
                        tokens_input=p_tokens,
                        tokens_output=c_tokens,
                        cost=total_cost,
                        model=active_model,
                        timestamp=datetime.utcnow(),
                        is_subscription_covered=has_subscription
                    )
                    db.add(usage_log)
                    db.commit()
                    
                    # Update DB record with usage
                    if 'bot_message' in locals() and bot_message.id:
                        bot_message.input_tokens = p_tokens
                        bot_message.output_tokens = c_tokens
                        bot_message.estimated_cost = total_cost
                        db.commit()
                        
                        # Terminal Log
                        print(f"\n{'='*20} COST & CHARGE {'='*20}")
                        print(f"User: {current_user.username}")
                        print(f"Tokens: {p_tokens} (In) / {c_tokens} (Out)")
                        print(f"Rates: {rate_input} (In) / {rate_output} (Out)")
                        print(f"Charged: {total_cost:.4f} ETB")
                        print(f"New Balance: {current_user.balance:.4f} ETB")
                        print(f"{'='*56}\n")
            except Exception as e:
                print(f"[COST LOG ERROR] Could not save cost: {e}")

# --- LEGAL DOCUMENT GENERATION ---

@app.post("/documents/generate")
async def generate_document(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Draft a formal Ethiopian legal document from a template + user-provided fields.

    Requires balance or an active subscription (premium action). Grounds the draft
    in the verified legal library where relevant and deducts the token cost.
    """
    if not gemini_client:
        raise HTTPException(status_code=500, detail="AI service not configured")

    template_name = (data.get("template_name") or "").strip()
    if not template_name:
        raise HTTPException(status_code=422, detail="A document type is required.")
    fields = data.get("fields") or {}
    language = "Amharic" if str(data.get("language", "en")).startswith("am") else "English"

    # --- Access gate: subscription or sufficient balance ---
    now = datetime.utcnow()
    has_subscription = bool(
        (current_user.subscription_expires_at and current_user.subscription_expires_at > now)
        or (current_user.monthly_subscription_expires_at and current_user.monthly_subscription_expires_at > now)
    )
    min_balance = get_min_balance(db)
    if not has_subscription and (current_user.balance or 0) < min_balance:
        raise HTTPException(
            status_code=402,
            detail=f"Please recharge (min {min_balance} ETB) or subscribe to generate documents."
        )

    # --- Build the details block from the provided fields ---
    detail_lines = []
    for k, v in fields.items():
        v = (str(v) if v is not None else "").strip()
        if v:
            detail_lines.append(f"- {k}: {v}")
    details_block = "\n".join(detail_lines) if detail_lines else "(No specific details provided — use clear placeholders throughout.)"

    # --- Optional grounding from the verified legal library ---
    grounding = ""
    try:
        query = template_name + " " + " ".join(str(v) for v in fields.values() if v)
        matches = legal_service.search_provisions(db, query)
        grounding = legal_service.build_system_addendum(matches) if matches else ""
    except Exception as _e:
        print(f"[DOC RAG] skipped: {_e}")

    model_setting = db.query(Setting).filter(Setting.key == "model_name").first()
    active_model = model_setting.value if model_setting else "gemini-2.5-flash"

    system_instruction = (
        f"You are EthioLex, an expert Ethiopian legal drafter. Draft a COMPLETE, professional, "
        f"ready-to-use {template_name} under Ethiopian law, written in {language}.\n"
        "Rules:\n"
        "- Use correct Ethiopian legal document structure and formal legal language.\n"
        "- Incorporate the details provided. Where a needed detail is missing, insert a clearly "
        "bracketed placeholder (e.g. [FULL NAME], [DATE], [AMOUNT]) for the user to complete.\n"
        "- Include a title, date line, identification of the parties, the operative clauses, and "
        "signature blocks.\n"
        "- Reference relevant Ethiopian law where appropriate, but never invent citations.\n"
        "- Output ONLY the document itself in clean Markdown. No preamble, notes, or explanation."
        + grounding
    )

    contents = [types.Content(role="user", parts=[types.Part.from_text(
        text=f"Draft the {template_name} using these details:\n{details_block}"
    )])]
    config = types.GenerateContentConfig(temperature=0.5, top_p=0.95, system_instruction=system_instruction)

    try:
        response = gemini_client.models.generate_content(model=active_model, contents=contents, config=config)
    except Exception as e:
        print(f"Document generation error: {repr(e)}")
        raise HTTPException(status_code=502, detail="The AI service is temporarily unavailable. Please try again.")

    document = (response.text or "").strip()
    if not document:
        raise HTTPException(status_code=502, detail="Could not generate the document. Please try again.")

    # --- Deduct token cost (same rates as chat); free for subscribers ---
    try:
        usage = getattr(response, "usage_metadata", None)
        if usage:
            p_tokens = usage.prompt_token_count or 0
            c_tokens = usage.candidates_token_count or 0
            in_rate = db.query(Setting).filter(Setting.key == "cost_input_1m").first()
            out_rate = db.query(Setting).filter(Setting.key == "cost_output_1m").first()
            rate_in = float(in_rate.value) if in_rate else 240.0
            rate_out = float(out_rate.value) if out_rate else 1440.0
            total_cost = (p_tokens / 1_000_000) * rate_in + (c_tokens / 1_000_000) * rate_out
            db.refresh(current_user)
            if not has_subscription:
                current_user.balance = max(0.0, (current_user.balance or 0) - total_cost)
            db.add(UsageLog(user_id=current_user.id, chat_id=None, tokens_input=p_tokens,
                            tokens_output=c_tokens, cost=total_cost, model=active_model,
                            timestamp=datetime.utcnow(), is_subscription_covered=has_subscription))
            db.commit()
    except Exception as e:
        print(f"[DOC COST] could not record cost: {e}")

    return {"document": document, "balance": current_user.balance}


# --- ADMIN ENDPOINTS ---

@app.get("/admin/users")
async def admin_get_users(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users (Admin only)"""
    users = db.query(User).all()
    
    user_list = []
    for u in users:
        # Calculate total cost for user (sum of estimated_cost in user's chat messages)
        # Detailed join: User -> Chat -> ChatMessage
        total_cost = db.query(func.sum(ChatMessage.estimated_cost)).\
            join(Chat, ChatMessage.chat_id == Chat.id).\
            filter(Chat.user_id == u.id).scalar() or 0.0
            
        user_list.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "balance": u.balance,
            "total_cost": total_cost, # Added for Admin Dashboard
            "is_admin": u.is_admin,
            "is_active": u.is_active if u.is_active is not None else True,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "subscription_expires_at": (u.subscription_expires_at.isoformat() + "Z") if u.subscription_expires_at else None,
            "monthly_subscription_expires_at": (u.monthly_subscription_expires_at.isoformat() + "Z") if u.monthly_subscription_expires_at else None
        })
        
    return user_list

@app.put("/admin/users/{user_id}/balance")
async def admin_update_balance(
    user_id: int,
    balance_data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update user balance (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_balance = balance_data.get("balance")
    if new_balance is not None:
        user.balance = float(new_balance)
        db.commit()
    
    return {"message": "Balance updated", "balance": user.balance}

@app.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete admin user")

    # Remove dependent rows first — Postgres enforces foreign keys. usage_logs and
    # payments have non-nullable user_id, so they are removed with the user.
    user_chat_ids = [row[0] for row in db.query(Chat.id).filter(Chat.user_id == user.id).all()]
    db.query(UsageLog).filter(UsageLog.user_id == user.id).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.user_id == user.id).delete(synchronize_session=False)
    if user_chat_ids:
        db.query(ChatMessage).filter(ChatMessage.chat_id.in_(user_chat_ids)).delete(synchronize_session=False)
        db.query(Chat).filter(Chat.id.in_(user_chat_ids)).delete(synchronize_session=False)

    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@app.put("/admin/users/{user_id}/toggle-active")
async def admin_toggle_user_active(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Toggle user active status (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot deactivate admin user")
    
    # Toggle is_active (handle None as True)
    current_status = user.is_active if user.is_active is not None else True
    user.is_active = not current_status
    db.commit()
    
    status_text = "activated" if user.is_active else "deactivated"
    return {"message": f"User {status_text}", "is_active": user.is_active}

@app.get("/admin/payments")
async def admin_get_payments(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all payments (Admin only)"""
    payments = db.query(Payment).order_by(Payment.created_at.desc()).all()
    return [{
        "id": p.id,
        "user_id": p.user_id,
        "username": p.user.username if p.user else "Unknown",
        "amount": p.amount,
        "tx_ref": p.tx_ref,
        "status": p.status,
        "payment_type": p.payment_type,
        "method": p.method or "chapa",
        "reference": p.reference,
        "has_receipt": bool(p.receipt_filename),
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in payments]

@app.get("/admin/payments/{payment_id}/receipt")
async def admin_get_payment_receipt(
    payment_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Download the receipt uploaded for a manual payment (Admin only)."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or not payment.receipt_filename:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Resolve within the receipts dir and guard against path traversal
    safe_name = os.path.basename(payment.receipt_filename)
    file_path = os.path.join(RECEIPTS_DIR, safe_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Receipt file is missing")

    return FileResponse(file_path, filename=safe_name)

@app.put("/admin/payments/{payment_id}/approve")
async def admin_approve_payment(
    payment_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Manually approve a payment (Admin only)"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.status == "success":
        return {"message": "Payment already approved"}

    # Admin has reviewed the receipt — credit via the shared path (uses the
    # amount recorded at submission time; there is no gateway amount for manual).
    user = _apply_verified_payment(payment, db)

    return {
        "message": "Payment approved",
        "new_balance": user.balance if user else None,
        "subscription_expires_at": (user.subscription_expires_at.isoformat() + "Z") if user and user.subscription_expires_at else None,
        "monthly_subscription_expires_at": (user.monthly_subscription_expires_at.isoformat() + "Z") if user and user.monthly_subscription_expires_at else None
    }

@app.put("/admin/payments/{payment_id}/reject")
async def admin_reject_payment(
    payment_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Reject a pending payment (Admin only)"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    payment.status = "failed"
    db.commit()
    return {"message": "Payment rejected"}

@app.get("/admin/settings")
async def admin_get_settings(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all settings (Admin only)"""
    settings = db.query(Setting).all()
    return [{
        "id": s.id,
        "key": s.key,
        "value": s.value,
        "description": s.description
    } for s in settings]

@app.put("/admin/settings/{key}")
async def admin_update_setting(
    key: str,
    setting_data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update a setting (Admin only)"""
    setting = db.query(Setting).filter(Setting.key == key).first()
    
    if not setting:
        # Create if doesn't exist
        setting = Setting(
            key=key,
            value=str(setting_data.get("value", "")),
            description=setting_data.get("description", "")
        )
        db.add(setting)
    else:
        setting.value = str(setting_data.get("value", setting.value))
        if "description" in setting_data:
            setting.description = setting_data["description"]
    
    db.commit()
    db.commit()
    return {"message": "Setting updated", "key": key, "value": setting.value}

# --- ADMIN: LEGAL LIBRARY (RAG knowledge base) ---

def _serialize_provision(p: LegalProvision) -> dict:
    return {
        "id": p.id,
        "law_code": p.law_code,
        "article": p.article,
        "title": p.title,
        "content": p.content,
        "language": p.language,
        "source_url": p.source_url,
        "is_active": p.is_active if p.is_active is not None else True,
        "has_embedding": p.embedding is not None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _embed_provision(p: LegalProvision):
    """(Re)generate the embedding for a provision from its key fields + content."""
    text_value = f"{p.law_code} {p.article or ''} {p.title or ''}\n{p.content}".strip()
    p.embedding = legal_service.embed_text(text_value)


@app.get("/admin/legal")
async def admin_list_provisions(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """List all legal provisions (Admin only)."""
    rows = db.query(LegalProvision).order_by(LegalProvision.id.desc()).all()
    return [_serialize_provision(p) for p in rows]


@app.post("/admin/legal")
async def admin_create_provision(data: dict, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Add a verified provision to the legal library (Admin only). Embeds on save."""
    law_code = (data.get("law_code") or "").strip()
    content = (data.get("content") or "").strip()
    if not law_code or not content:
        raise HTTPException(status_code=422, detail="Law name and provision text are required.")

    p = LegalProvision(
        law_code=law_code,
        article=(data.get("article") or "").strip() or None,
        title=(data.get("title") or "").strip() or None,
        content=content,
        language=(data.get("language") or "en").strip() or "en",
        source_url=(data.get("source_url") or "").strip() or None,
        is_active=bool(data.get("is_active", True)),
    )
    try:
        _embed_provision(p)
    except Exception as e:
        print(f"[LEGAL KB] embedding failed on create: {e}")
        raise HTTPException(status_code=502, detail="Could not generate the embedding. Please try again.")

    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize_provision(p)


@app.put("/admin/legal/{pid}")
async def admin_update_provision(pid: int, data: dict, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Update a provision (Admin only). Re-embeds if the content/reference changed."""
    p = db.query(LegalProvision).filter(LegalProvision.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provision not found")

    relevant_changed = False
    for field in ("law_code", "article", "title", "content", "language", "source_url"):
        if field in data:
            val = data.get(field)
            if isinstance(val, str):
                val = val.strip() or None
            if field in ("law_code", "article", "title", "content") and val != getattr(p, field):
                relevant_changed = True
            setattr(p, field, val)
    if "is_active" in data:
        p.is_active = bool(data["is_active"])

    if not (p.law_code or "").strip() or not (p.content or "").strip():
        raise HTTPException(status_code=422, detail="Law name and provision text are required.")

    if relevant_changed or p.embedding is None:
        try:
            _embed_provision(p)
        except Exception as e:
            print(f"[LEGAL KB] embedding failed on update: {e}")
            raise HTTPException(status_code=502, detail="Could not regenerate the embedding. Please try again.")

    db.commit()
    db.refresh(p)
    return _serialize_provision(p)


@app.delete("/admin/legal/{pid}")
async def admin_delete_provision(pid: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Delete a provision (Admin only)."""
    p = db.query(LegalProvision).filter(LegalProvision.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provision not found")
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}

# --- PUBLIC SETTINGS ENDPOINT ---

@app.get("/settings/public")
async def get_public_settings(db: Session = Depends(get_db)):
    """Get public settings (Unauthenticated)"""
    # Define which keys are safe to expose
    public_keys = [
        "subscription_24h_price", "min_search_balance", "search_cost",
        "subscription_daily_quota", "subscription_monthly_price",
        "subscription_monthly_quota", "quota_reset_hours",
        # Per-option availability toggles
        "chapa_enabled", "telebirr_enabled", "safaricom_enabled", "bank_enabled",
        "manual_payment_instructions",
        # Manual payment account details
        "telebirr_number", "telebirr_name",
        "safaricom_number", "safaricom_name",
        # Banks: JSON list [{label, number, holder}]. The single bank_* keys are
        # kept for backward compatibility with configs saved before the list.
        "bank_accounts",
        "bank_name", "bank_account", "bank_holder",
        # Contact admin channels
        "admin_contact_phone", "admin_contact_telegram", "admin_contact_email",
    ]
    
    settings = db.query(Setting).filter(Setting.key.in_(public_keys)).all()
    
    return [{
        "key": s.key,
        "value": s.value,
        "description": s.description
    } for s in settings]

@app.get("/settings/search-cost")
async def get_public_search_cost(db: Session = Depends(get_db)):
    """Get search cost setting (Public)"""
    cost = get_search_cost(db)
    return {"search_cost": cost}

@app.get("/settings/min-balance")
async def get_public_min_balance(db: Session = Depends(get_db)):
    """Get minimum balance setting (Public)"""
    min_balance = get_min_balance(db)
    return {"min_balance": min_balance}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "running",
        "message": "EthioLex Backend API is running",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)