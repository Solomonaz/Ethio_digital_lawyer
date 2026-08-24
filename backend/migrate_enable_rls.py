"""
SECURITY migration: lock down the Supabase REST (PostgREST) surface.

Supabase auto-exposes every table in the `public` schema through its REST API,
reachable with the *public* anon key. Because these tables were created by
SQLAlchemy without Row-Level Security, the anon key could read AND write all of
them (password hashes, balances, is_admin, ...). This migration:

  1. ENABLEs Row-Level Security on every app table (with NO policies, so anon /
     authenticated get zero access through PostgREST).
  2. REVOKEs table privileges from the anon and authenticated roles.

The backend connects as the `postgres` table owner, which bypasses RLS, so the
application keeps working unchanged. Idempotent.
"""
from dotenv import load_dotenv
load_dotenv()

import os
from sqlalchemy import create_engine, text

APP_TABLES = [
    "users", "chats", "chat_messages", "payments",
    "settings", "usage_logs", "pending_registrations",
]


def migrate():
    url = os.getenv("DATABASE_URL")
    if not url or url.startswith("sqlite"):
        raise SystemExit("Refusing to run: DATABASE_URL must point to Supabase/Postgres.")
    engine = create_engine(url, pool_pre_ping=True)
    with engine.begin() as conn:
        for t in APP_TABLES:
            # 1) Enable RLS (no policies => deny all non-owner access)
            conn.execute(text(f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY;'))
            # 2) Revoke direct grants from the PostgREST roles (defense in depth)
            conn.execute(text(f'REVOKE ALL ON public."{t}" FROM anon, authenticated;'))
            print(f"  locked down: {t}")
    print("RLS enabled and grants revoked on all app tables.")


if __name__ == "__main__":
    migrate()
