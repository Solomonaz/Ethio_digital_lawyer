from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
from dotenv import load_dotenv
import base64

from database import engine, Base, get_db
from models import User, Chat, ChatMessage, Payment, Setting
import uuid
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    ChatCreate, ChatResponse, SendMessageRequest
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    decode_access_token
)

import google.generativeai as genai

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EthioLex Backend API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# System instruction for EthioLex
SYSTEM_INSTRUCTION = """You are EthioLex, a highly skilled and professional AI Digital Lawyer specialized in Ethiopian Law.

**CORE DIRECTIVE**: You are a STRICTLY LEGAL AI. You must ONLY answer questions related to Ethiopian Law, legal procedures, court cases, rights, and regulations (Constitution, Criminal Code, Civil Code, Labor Proclamation, etc.).

**STRICT SCOPE ENFORCEMENT**:
Before answering, evaluate the user's query:
1. **Is this a legal question?** (e.g., "How do I sue?", "What is the penalty for theft?", "Landlord rights").
2. **Is this a non-legal question?** (e.g., "How to bake injera?", "Who is the prime minister?", "Write me a poem", "Solve this math problem").
3. **IF NON-LEGAL**: You MUST politely refuse to answer. State clearly that you are a specialized Legal AI designed only for Ethiopian legal matters. Do not provide the non-legal information.

**RESPONSE GUIDELINES**:
1. **Analyze the Situation**: Understand the legal implications.
2. **Cite Sources**: Reference specific Articles/Proclamations when possible. Mention "Article X of the Criminal Code" or "Proclamation No. Y".
3. **Language**: Respond in the language of the user's question (English or Amharic).
4. **Tone**: Professional, objective, empathetic.
5. **Disclaimer**: ALWAYS conclude with a reminder that this is information, not legal advice, and to consult a qualified lawyer.

**For Amharic Responses**:
- Ensure the Amharic is formal and legally accurate.
- Translate legal terms appropriately."""

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# --- Dependency to get current user ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    username = decode_access_token(token)
    if username is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
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
def get_search_cost(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "search_cost").first()
    if setting:
        return float(setting.value)
    return 30.0  # Default

# --- AUTH ENDPOINTS ---

@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Extract username from email (part before @)
    username = user_data.email.split('@')[0]
    
    # Check if user exists by email or username
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == username)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=username,
        name=user_data.name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=hashed_password,
        auth_provider="local"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": new_user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "username": new_user.username
    }

@app.post("/auth/token", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }

@app.post("/auth/google", response_model=Token)
async def google_login(google_data: dict, db: Session = Depends(get_db)):
    """Google OAuth login"""
    username = google_data.get("username")
    email = google_data.get("email")
    firebase_uid = google_data.get("firebaseUid")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Extract username from email (part before @)
    username_from_email = email.split('@')[0]
    
    # Try to find user by email first (more reliable)
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create new user for Google sign-in
        # Use email part as username for uniqueness
        user = User(
            username=username_from_email,
            name=username or username_from_email,
            email=email,
            phone_number=None,
            password_hash="",  # No password for Google users
            auth_provider="google",
            is_active=True # New users are active by default
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }

@app.get("/users/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

# --- PAYMENT ENDPOINTS ---
from services.chapa_service import ChapaService

class PaymentRequest:
    def __init__(self, amount: str, email: str, first_name: str = "EthioLex", last_name: str = "User"):
        self.amount = amount
        self.email = email
        self.first_name = first_name
        self.last_name = last_name

from pydantic import BaseModel as PydanticBaseModel

class PaymentInitRequest(PydanticBaseModel):
    amount: str
    email: str
    first_name: str = "EthioLex"
    last_name: str = "User"

@app.post("/payment/initialize")
async def initialize_payment(
    request: PaymentInitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize a Chapa payment for balance recharge"""
    tx_ref = f"ethiolex-{uuid.uuid4().hex[:12]}"
    
    result = ChapaService.initialize_payment(
        email=request.email,
        amount=request.amount,
        first_name=request.first_name,
        last_name=request.last_name,
        tx_ref=tx_ref,
        return_url=f"http://localhost:5173/payment/callback?tx_ref={tx_ref}"
    )
    
    if not result or result.get("status") != "success":
        raise HTTPException(status_code=400, detail="Failed to initialize payment")
    
    # Save payment record
    new_payment = Payment(
        user_id=current_user.id,
        amount=float(request.amount),
        tx_ref=tx_ref,
        status="pending"
    )
    db.add(new_payment)
    db.commit()
    
    return {
        "checkout_url": result.get("data", {}).get("checkout_url"),
        "tx_ref": tx_ref
    }

@app.get("/payment/verify/{tx_ref}")
async def verify_payment(
    tx_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify payment status and credit balance if successful"""
    payment = db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Already processed
    if payment.status == "success":
        return {"status": "success", "message": "Payment already verified", "balance": current_user.balance}
    
    result = ChapaService.verify_payment(tx_ref)
    
    if result and result.get("status") == "success":
        data = result.get("data", {})
        if data.get("status") == "success":
            payment.status = "success"
            
            # Credit User Balance
            user = db.query(User).filter(User.id == payment.user_id).first()
            if user:
                user.balance += payment.amount
            
            db.commit()
            db.refresh(user)
            
            return {"status": "success", "message": "Payment verified successfully", "balance": user.balance}
    
    return {"status": "pending", "message": "Payment verification pending or failed"}

@app.post("/payment/callback")
async def payment_callback(data: dict, db: Session = Depends(get_db)):
    """Handle Chapa webhook/callback"""
    tx_ref = data.get("tx_ref")
    status_msg = data.get("status")
    
    if tx_ref:
        payment = db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
        if payment and payment.status != "success":
            if status_msg == "success":
                payment.status = "success"
                # Credit User Balance
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    user.balance += payment.amount
            elif status_msg == "failed":
                payment.status = "failed"
            db.commit()
    
    return {"status": "ok"}

# --- CHAT ENDPOINTS ---

@app.get("/chats")
async def get_user_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all chat sessions for current user"""
    chats = db.query(Chat).filter(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    
    result = []
    for chat in chats:
        messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).order_by(ChatMessage.timestamp).all()
        result.append({
            "id": str(chat.id),
            "user_id": chat.user_id,
            "title": chat.title,
            "updated_at": chat.updated_at.isoformat(),
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat()
                }
                for msg in messages
            ]
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
    
    # Delete all messages first
    db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).delete()
    
    # Delete chat
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

    # Free Search Logic (First 2 searches are free)
    is_free_search = user_message_count < 2
    
    if not is_free_search:
        # Check User Balance (Cost from settings)
        search_cost = get_search_cost(db)
        if current_user.balance < search_cost:
            raise HTTPException(
                status_code=402,  # Payment Required
                detail=f"Insufficient balance. Your current balance is {current_user.balance:.2f} ETB. A search costs {search_cost:.2f} ETB. Please recharge to continue."
            )
        
        # Deduct Search Cost
        current_user.balance -= search_cost
        db.commit()
        db.refresh(current_user)
    
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
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
            
        model = genai.GenerativeModel(
            model_name="gemini-3-pro-preview",
            # model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Build conversation history
        history = []
        for msg in chat_history[:-1]:  # Exclude the message we just added
            history.append({
                "role": msg.role,
                "parts": [msg.content]
            })
        
        # Handle attachments if present
        parts = [message_data.message]
        
        # Apply Free Search Limitation
        if is_free_search:
            parts[0] += "\n\nIMPORTANT: This is a free trial search. You MUST LIMIT your response. Only provide the relevant legal Article(s) and a very brief explanation. Do NOT provide a robust detailed analysis. END the response with this exact caption: '\n\n*This is a limited free search. Please recharge your account for a robust and complete response.*'"

        if message_data.attachments:
            for attachment in message_data.attachments:
                if attachment["type"] == "image":
                    # Convert base64 to image
                    image_data = base64.b64decode(attachment["data"])
                    parts.append({
                        "mime_type": attachment["mimeType"],
                        "data": image_data
                    })
        
        # Start chat with history
        chat_session = model.start_chat(history=history)
        
        # Configure generation
        generation_config = genai.types.GenerationConfig(
            temperature=0.7,
            top_p=0.95,
            top_k=40,
            max_output_tokens=2048,
        )
        
        # Send message
        response = chat_session.send_message(
            parts,
            generation_config=generation_config
        )
        
        bot_text = response.text
        
        # Extract grounding sources if available
        grounding_sources = []
        if hasattr(response, 'grounding_metadata') and response.grounding_metadata:
            for source in response.grounding_metadata.grounding_chunks:
                if hasattr(source, 'web'):
                    grounding_sources.append({
                        "title": source.web.title if hasattr(source.web, 'title') else None,
                        "uri": source.web.uri if hasattr(source.web, 'uri') else None
                    })
        
        # Save bot response
        bot_message = ChatMessage(
            chat_id=chat.id,
            role="model",
            content=bot_text
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
            "groundingSources": grounding_sources if grounding_sources else None
        }
        
    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# --- ADMIN ENDPOINTS ---

@app.get("/admin/users")
async def admin_get_users(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users (Admin only)"""
    users = db.query(User).all()
    return [{
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "balance": u.balance,
        "is_admin": u.is_admin,
        "is_active": u.is_active if u.is_active is not None else True,
        "created_at": u.created_at.isoformat() if u.created_at else None
    } for u in users]

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
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in payments]

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
    
    payment.status = "success"
    user = db.query(User).filter(User.id == payment.user_id).first()
    if user:
        user.balance += payment.amount
    
    db.commit()
    return {"message": "Payment approved", "new_balance": user.balance if user else None}

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
    return {"message": "Setting updated", "key": key, "value": setting.value}

# --- PUBLIC SETTINGS ENDPOINT ---

@app.get("/settings/search-cost")
async def get_public_search_cost(db: Session = Depends(get_db)):
    """Get search cost setting (Public)"""
    cost = get_search_cost(db)
    return {"search_cost": cost}

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