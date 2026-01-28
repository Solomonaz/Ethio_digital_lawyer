from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    phone_number = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    auth_provider = Column(String, default="local")  # 'local' or 'google'
    created_at = Column(DateTime, default=datetime.utcnow)
    balance = Column(Float, default=0.0)  # User's account balance in ETB
    is_admin = Column(Boolean, default=False)  # Admin flag
    is_active = Column(Boolean, default=True)  # Account active status
    
    # Phone Verification Fields
    is_verified = Column(Boolean, default=False)  # Phone verified status
    verification_code = Column(String, nullable=True)  # 6-digit code
    verification_code_expires = Column(DateTime, nullable=True)  # Code expiry time
    
    # Subscription Fields
    subscription_expires_at = Column(DateTime, nullable=True) # Expiry time for 24h subscription
    monthly_subscription_expires_at = Column(DateTime, nullable=True) # Expiry time for monthly subscription

    # Relationships
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="New Consultation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'model'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Cost Tracking
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    
    # Relationships
    chat = relationship("Chat", back_populates="messages")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    tx_ref = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")  # pending, success, failed
    payment_type = Column(String, default="recharge") # recharge, subscription_24h
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")

class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    model = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    is_subscription_covered = Column(Boolean, default=False)


class PendingRegistration(Base):
    """Temporary storage for registration data until phone verification is complete"""
    __tablename__ = "pending_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    verification_code = Column(String, nullable=False)
    verification_code_expires = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)