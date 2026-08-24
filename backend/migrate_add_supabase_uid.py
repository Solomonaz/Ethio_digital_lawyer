"""
Migration: add users.supabase_uid (links an app profile to a Supabase auth user)
and make users.password_hash nullable (Supabase-managed accounts have no local hash).

Runs against whatever DATABASE_URL points to (now Supabase Postgres). Idempotent.
"""
from sqlalchemy import create_engine, text
from database import DATABASE_URL


def migrate():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        print("Adding users.supabase_uid ...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN supabase_uid VARCHAR"))
            print("  added column supabase_uid")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("  supabase_uid already exists")
            else:
                print(f"  note: {e}")

        # Unique index (partial-safe): unique across non-null values
        try:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_supabase_uid "
                "ON users (supabase_uid)"
            ))
            print("  ensured unique index on supabase_uid")
        except Exception as e:
            print(f"  note (index): {e}")

        # Allow null password_hash for Supabase-managed accounts
        try:
            conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
            print("  password_hash is now nullable")
        except Exception as e:
            # SQLite path / already nullable — non-fatal
            print(f"  note (password_hash nullable): {str(e)[:80]}")

        conn.commit()
        print("Migration complete.")


if __name__ == "__main__":
    migrate()
