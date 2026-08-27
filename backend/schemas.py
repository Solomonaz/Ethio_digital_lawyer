from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- User Schemas ---
class UserCreate(BaseModel):
    name: str
    email: str
    phone_number: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    username: str
    email: str

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: Optional[datetime] = None
    auth_provider: str
    balance: float = 0.0
    is_admin: bool = False
    subscription_expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str

# --- Telegram Login Schema ---
# The raw payload delivered by the Telegram Login Widget. All fields except id,
# auth_date and hash are optional (a Telegram account may have no username, last
# name, or public photo). The signature is verified server-side before use.
class TelegramLoginRequest(BaseModel):
    id: int
    auth_date: int
    hash: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None

# --- Phone Verification Schemas ---
class RequestVerificationCode(BaseModel):
    phone_number: str

class VerifyPhoneCode(BaseModel):
    phone_number: str
    code: str

# --- Chat Schemas ---
class ChatCreate(BaseModel):
    title: str = "New Consultation"

class ChatMessageBase(BaseModel):
    role: str
    content: str
    timestamp: str

class ChatResponse(BaseModel):
    id: str
    user_id: int
    title: str
    updated_at: str
    messages: List[Dict[str, Any]]

class ChatMessageCreate(BaseModel):
    message: str

class AttachmentSchema(BaseModel):
    type: str
    mimeType: str
    data: str
    name: Optional[str] = None

class SendMessageRequest(BaseModel):
    message: str
    language: str
    attachments: Optional[List[Dict[str, Any]]] = None
    # Answer stance: "neutral" (default), "lawyer" (advocate for the user),
    # or "claimant" (help build a claim against another party). Validated server-side.
    perspective: Optional[str] = None

class GroundingSource(BaseModel):
    title: Optional[str] = None
    uri: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    text: str
    timestamp: str
    groundingSources: Optional[List[Dict[str, Optional[str]]]] = None