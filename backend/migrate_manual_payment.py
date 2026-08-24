"""
Migration: Manual payment method (Telebirr / Safaricom / Bank) + Contact Admin.

- Adds `method` and `reference` columns to the payments table (nullable / safe).
- Backfills existing payments with method = 'chapa'.
- Seeds admin-configurable settings for manual payment accounts and contact channels.

Idempotent: safe to run multiple times.
"""
from sqlalchemy import create_engine, text
from database import DATABASE_URL


# New settings seeded for the manual-payment + contact-admin feature.
# Values are intentionally empty so the admin fills them in from the dashboard;
# the frontend only renders a channel/account when its value is non-empty.
DEFAULT_SETTINGS = [
    ("chapa_enabled", "true", "Show the Chapa online payment option to users"),
    ("manual_payment_enabled", "true", "Show the manual (Telebirr/Safaricom/Bank) payment option to users"),
    ("manual_payment_instructions",
     "Send your payment to one of the accounts below. After paying, enter your "
     "transaction number and submit. Then send the receipt to the admin using the "
     "contact options. Your balance will be updated once the admin confirms.",
     "Instructions shown to users on the manual payment screen"),
    ("telebirr_number", "", "Telebirr account phone number for manual payments"),
    ("telebirr_name", "", "Telebirr account holder name"),
    ("safaricom_number", "", "Safaricom / M-Pesa account phone number for manual payments"),
    ("safaricom_name", "", "Safaricom / M-Pesa account holder name"),
    ("cbe_account", "", "Commercial Bank of Ethiopia (CBE) account number for manual payments"),
    ("cbe_name", "", "CBE bank account holder name"),
    ("admin_contact_phone", "", "Admin phone number shown in Contact Admin"),
    ("admin_contact_telegram", "", "Admin Telegram username or link shown in Contact Admin"),
    ("admin_contact_email", "", "Admin email address shown in Contact Admin"),
]


def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Migrating database for manual payment + contact admin feature...")

        # 1. Add `method` column to payments
        try:
            conn.execute(text("ALTER TABLE payments ADD COLUMN method VARCHAR DEFAULT 'chapa'"))
            print("Added `method` column to payments table.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column `method` already exists.")
            else:
                print(f"Note while adding `method`: {e}")

        # 2. Add `reference` column to payments
        try:
            conn.execute(text("ALTER TABLE payments ADD COLUMN reference VARCHAR"))
            print("Added `reference` column to payments table.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column `reference` already exists.")
            else:
                print(f"Note while adding `reference`: {e}")

        # 3. Backfill existing rows so they are clearly Chapa payments
        try:
            conn.execute(text("UPDATE payments SET method = 'chapa' WHERE method IS NULL"))
            print("Backfilled existing payments with method = 'chapa'.")
        except Exception as e:
            print(f"Note while backfilling method: {e}")

        # 4. Seed new settings (only if missing — never overwrite admin's values)
        for key, value, desc in DEFAULT_SETTINGS:
            try:
                existing = conn.execute(
                    text("SELECT 1 FROM settings WHERE key = :key"), {"key": key}
                ).fetchone()
                if not existing:
                    conn.execute(
                        text(
                            "INSERT INTO settings (key, value, description, updated_at) "
                            "VALUES (:key, :value, :desc, CURRENT_TIMESTAMP)"
                        ),
                        {"key": key, "value": value, "desc": desc},
                    )
                    print(f"Seeded setting: {key}")
                else:
                    print(f"Setting already exists: {key}")
            except Exception as e:
                print(f"Error seeding setting {key}: {e}")

        conn.commit()
        print("Migration complete!")


if __name__ == "__main__":
    migrate()
