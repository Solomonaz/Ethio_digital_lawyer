from database import engine, Base, SessionLocal
from models import User, Setting
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

print("=" * 60)
print("DATABASE SETUP & SEEDING SCRIPT")
print("=" * 60)

# Create tables
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Seed Settings
default_settings = [
    {"key": "model_name", "value": "gemini-2.5-flash", "desc": "Active AI Model Name"},
    {"key": "search_grounding_model", "value": "", "desc": "Gemini model for Google Search web grounding when no verified provision matches. Blank = web search disabled."},
    {"key": "cost_input_1m", "value": "240.0", "desc": "Cost in ETB per 1 Million Input Tokens"},
    {"key": "cost_output_1m", "value": "1440.0", "desc": "Cost in ETB per 1 Million Output Tokens"},
    {"key": "subscription_24h_price", "value": "100.0", "desc": "Price for 24-hour subscription (ETB)"},
    {"key": "subscription_monthly_price", "value": "1000.0", "desc": "Price for 30-day subscription (ETB)"},
    {"key": "subscription_daily_quota", "value": "20", "desc": "Daily search limit for 24h subscription"},
    {"key": "subscription_monthly_quota", "value": "600", "desc": "Monthly search limit for monthly subscription"},
    {"key": "quota_reset_hours", "value": "24", "desc": "Rolling window hours for subscription quota resets"},
    {"key": "min_search_balance", "value": "5.0", "desc": "Minimum balance required to perform a search (ETB)"},
    {"key": "search_cost", "value": "10.0", "desc": "Cost per search in ETB for pay-per-search users"},
    # --- Payment methods (Chapa online + manual Telebirr/Safaricom/Bank) ---
    # Each option has its own on/off toggle so the admin can enable/disable individually.
    {"key": "chapa_enabled", "value": "true", "desc": "Enable the Chapa online payment option"},
    {"key": "telebirr_enabled", "value": "true", "desc": "Enable the Telebirr manual payment option"},
    {"key": "safaricom_enabled", "value": "true", "desc": "Enable the Safaricom / M-Pesa manual payment option"},
    {"key": "bank_enabled", "value": "true", "desc": "Enable the bank transfer manual payment option"},
    {"key": "manual_payment_instructions", "value": "Send your payment to one of the accounts below. After paying, enter your transaction number, attach the receipt, and submit. Your balance will be updated once the admin confirms.", "desc": "Instructions shown to users on the manual payment screen"},
    {"key": "telebirr_number", "value": "", "desc": "Telebirr account phone number for manual payments"},
    {"key": "telebirr_name", "value": "", "desc": "Telebirr account holder name"},
    {"key": "safaricom_number", "value": "", "desc": "Safaricom / M-Pesa account phone number for manual payments"},
    {"key": "safaricom_name", "value": "", "desc": "Safaricom / M-Pesa account holder name"},
    {"key": "bank_name", "value": "", "desc": "Bank name shown to users (e.g. Commercial Bank of Ethiopia, Awash Bank)"},
    {"key": "bank_account", "value": "", "desc": "Bank account number for manual payments"},
    {"key": "bank_holder", "value": "", "desc": "Bank account holder name"},
    # --- Contact admin channels ---
    {"key": "admin_contact_phone", "value": "", "desc": "Admin phone number shown in Contact Admin"},
    {"key": "admin_contact_telegram", "value": "", "desc": "Admin Telegram username or link shown in Contact Admin"},
    {"key": "admin_contact_email", "value": "", "desc": "Admin email address shown in Contact Admin"},
]

for s in default_settings:
    existing = db.query(Setting).filter(Setting.key == s["key"]).first()
    if not existing:
        new_setting = Setting(key=s["key"], value=s["value"], description=s["desc"])
        db.add(new_setting)
        print(f"Seeded setting: {s['key']} = {s['value']}")

# Create Admin User
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ethiolex.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
admin_username = ADMIN_EMAIL.split('@')[0]

existing_admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
if not existing_admin:
    password_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_admin = User(
        username=admin_username,
        email=ADMIN_EMAIL,
        password_hash=password_hash,
        is_admin=True,
        is_verified=True,
        balance=1000.0
    )
    db.add(new_admin)
    print(f"Created Admin User: {ADMIN_EMAIL} with password: {ADMIN_PASSWORD}")
else:
    print(f"Admin User {ADMIN_EMAIL} already exists.")

db.commit()
db.close()
print("\nDatabase setup and seeding completed successfully!")
print("=" * 60)
