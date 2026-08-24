"""
Migration v2: per-option payment toggles, editable bank name, receipt upload.

- Adds `receipt_filename` column to payments (nullable / safe).
- Adds per-option enable flags: chapa_enabled (kept), telebirr_enabled, safaricom_enabled, bank_enabled.
- Adds editable bank fields: bank_name, bank_account, bank_holder (migrating any old cbe_* values).
- Removes deprecated keys: cbe_account, cbe_name, manual_payment_enabled.

Idempotent: safe to run multiple times.
"""
from sqlalchemy import create_engine, text
from database import DATABASE_URL


NEW_SETTINGS = [
    ("chapa_enabled", "true", "Enable the Chapa online payment option"),
    ("telebirr_enabled", "true", "Enable the Telebirr manual payment option"),
    ("safaricom_enabled", "true", "Enable the Safaricom / M-Pesa manual payment option"),
    ("bank_enabled", "true", "Enable the bank transfer manual payment option"),
    ("bank_name", "", "Bank name shown to users (e.g. Commercial Bank of Ethiopia, Awash Bank)"),
    ("bank_account", "", "Bank account number for manual payments"),
    ("bank_holder", "", "Bank account holder name"),
    ("manual_payment_instructions",
     "Send your payment to one of the accounts below. After paying, enter your "
     "transaction number, attach the receipt, and submit. Your balance will be "
     "updated once the admin confirms.",
     "Instructions shown to users on the manual payment screen"),
]

DEPRECATED_KEYS = ["cbe_account", "cbe_name", "manual_payment_enabled"]


def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Migrating: per-option toggles + editable bank + receipt upload...")

        # 1. Add receipt_filename column
        try:
            conn.execute(text("ALTER TABLE payments ADD COLUMN receipt_filename VARCHAR"))
            print("Added `receipt_filename` column to payments table.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column `receipt_filename` already exists.")
            else:
                print(f"Note while adding `receipt_filename`: {e}")

        def get_value(key):
            row = conn.execute(text("SELECT value FROM settings WHERE key = :k"), {"k": key}).fetchone()
            return row[0] if row else None

        def upsert(key, value, desc):
            existing = conn.execute(text("SELECT 1 FROM settings WHERE key = :k"), {"k": key}).fetchone()
            if existing:
                print(f"Setting already exists: {key}")
            else:
                conn.execute(
                    text("INSERT INTO settings (key, value, description, updated_at) "
                         "VALUES (:k, :v, :d, CURRENT_TIMESTAMP)"),
                    {"k": key, "v": value, "d": desc},
                )
                print(f"Seeded setting: {key}")

        # 2. Migrate any previously entered CBE values into the new bank_* fields
        old_cbe_account = get_value("cbe_account")
        old_cbe_name = get_value("cbe_name")

        for key, value, desc in NEW_SETTINGS:
            # Carry over old CBE data if present so nothing is lost
            if key == "bank_account" and old_cbe_account:
                value = old_cbe_account
            if key == "bank_holder" and old_cbe_name:
                value = old_cbe_name
            if key == "bank_name" and (old_cbe_account or old_cbe_name):
                value = "Commercial Bank of Ethiopia"
            upsert(key, value, desc)

        # 3. Remove deprecated keys
        for key in DEPRECATED_KEYS:
            try:
                conn.execute(text("DELETE FROM settings WHERE key = :k"), {"k": key})
                print(f"Removed deprecated setting: {key}")
            except Exception as e:
                print(f"Note while removing {key}: {e}")

        conn.commit()
        print("Migration v2 complete!")


if __name__ == "__main__":
    migrate()
