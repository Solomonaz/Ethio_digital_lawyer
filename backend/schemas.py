from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- User Schemas ---
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class GoogleLoginRequest(BaseModel):
    username: str
    email: str

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    auth_provider: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str

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

class GroundingSource(BaseModel):
    title: Optional[str] = None
    uri: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    text: str
    timestamp: str
    groundingSources: Optional[List[Dict[str, Optional[str]]]] = None