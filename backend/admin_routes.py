from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Payment, Chat, SystemSetting
from schemas import UserResponse, SystemConfig
from auth import oauth2_scheme, decode_access_token
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin", tags=["admin"])

def get_current_admin_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    username = decode_access_token(token)
    if not username:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Simple check - in production use a more robust role system
    if user.is_admin != "True":
         raise HTTPException(status_code=403, detail="Not authorized")
    return user

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    total_users = db.query(User).count()
    total_payments = db.query(Payment).count()
    
    # Calculate total revenue
    payments = db.query(Payment).filter(Payment.status == "success").all()
    total_revenue = sum(float(p.amount) for p in payments)
    
    total_chats = db.query(Chat).count()
    
    today = datetime.utcnow().date()
    new_users_today = db.query(User).filter(User.created_at >= today).count()
    
    return {
        "total_users": total_users,
        "total_revenue": total_revenue,
        "total_chats": total_chats,
        "new_users_today": new_users_today
    }

@router.get("/users", response_model=List[UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.get("/payments")
def get_payments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    payments = db.query(Payment).order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
    return payments

@router.put("/settings")
def update_settings(config: SystemConfig, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "search_cost").first()
    if not setting:
        setting = SystemSetting(key="search_cost", value=str(config.search_cost), description="Cost per search in ETB")
        db.add(setting)
    else:
        setting.value = str(config.search_cost)
    db.commit()
    return {"message": "Settings updated", "search_cost": config.search_cost}
