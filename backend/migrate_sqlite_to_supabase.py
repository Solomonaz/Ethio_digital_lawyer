"""
One-time data migration: local SQLite  ->  Supabase Postgres.

Copies every row from the local SQLite database into your Supabase Postgres
database, preserving primary keys and foreign-key relationships, then fixes the
Postgres auto-increment sequences so new inserts continue correctly.

USAGE (PowerShell):
    # 1. Point TARGET_DB_URL at your Supabase pooler connection string:
    $env:TARGET_DB_URL = "postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
    # 2. (optional) override the source; defaults to the local SQLite file:
    # $env:SOURCE_DB_URL = "sqlite:///./ethiolex.db"
    # 3. Run it:
    python migrate_sqlite_to_supabase.py

Safe to re-run: it uses INSERT-or-UPDATE (merge) on primary keys, so running it
again simply re-syncs the rows. It never deletes anything on the target.
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from models import Base, User, Setting, PendingRegistration, Chat, ChatMessage, Payment, UsageLog

SOURCE_DB_URL = os.getenv("SOURCE_DB_URL", "sqlite:///./ethiolex.db")
TARGET_DB_URL = os.getenv("TARGET_DB_URL")

# Parents before children so foreign keys always resolve.
MIGRATION_ORDER = [
    (User, "users", "id"),
    (Setting, "settings", "id"),
    (PendingRegistration, "pending_registrations", "id"),
    (Chat, "chats", "id"),
    (ChatMessage, "chat_messages", "id"),
    (Payment, "payments", "id"),
    (UsageLog, "usage_logs", "id"),
]


def main():
    if not TARGET_DB_URL:
        raise SystemExit("ERROR: set TARGET_DB_URL to your Supabase Postgres connection string first.")
    if TARGET_DB_URL.startswith("sqlite"):
        raise SystemExit("ERROR: TARGET_DB_URL looks like SQLite. It must be your Supabase Postgres URL.")

    print(f"Source: {SOURCE_DB_URL}")
    print(f"Target: {TARGET_DB_URL.split('@')[-1]}")  # hide credentials in logs

    src_engine = create_engine(
        SOURCE_DB_URL,
        connect_args={"check_same_thread": False} if SOURCE_DB_URL.startswith("sqlite") else {},
    )
    dst_engine = create_engine(TARGET_DB_URL, pool_pre_ping=True)

    # Create the full schema on the target (no-op if it already exists).
    print("Ensuring schema exists on target...")
    Base.metadata.create_all(bind=dst_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)
    src = SrcSession()
    dst = DstSession()

    try:
        for model, table, pk in MIGRATION_ORDER:
            rows = src.query(model).all()
            for row in rows:
                data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
                dst.merge(model(**data))
            dst.commit()
            print(f"  {table}: copied {len(rows)} row(s)")

        # Fix Postgres sequences so the next auto-increment id is correct.
        print("Resetting Postgres sequences...")
        for _model, table, pk in MIGRATION_ORDER:
            dst.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{table}', '{pk}'), "
                f"COALESCE((SELECT MAX({pk}) FROM {table}), 1), true)"
            ))
        dst.commit()

        print("\nMigration complete. Your Supabase database now mirrors the local SQLite data.")
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
