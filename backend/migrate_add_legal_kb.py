"""
Migration: legal knowledge base (RAG) for grounded, cited answers.

- Enables pgvector.
- Creates the legal_provisions table (via the model) + an HNSW cosine index.
- Adds chat_messages.legal_citations (TEXT / JSON) to persist citations.

Idempotent.
"""
from dotenv import load_dotenv
load_dotenv()

import os
from sqlalchemy import create_engine, text, inspect
from database import Base, engine
import models  # noqa: F401 — ensure all models (incl. LegalProvision) are registered


def migrate():
    url = os.getenv("DATABASE_URL")
    if not url or url.startswith("sqlite"):
        raise SystemExit("Refusing to run: DATABASE_URL must point to Supabase/Postgres.")

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        print("pgvector ready.")

    # Create legal_provisions (and any other missing tables) from the models.
    Base.metadata.create_all(bind=engine)
    print("legal_provisions table ensured.")

    with engine.begin() as conn:
        # HNSW index for fast cosine similarity search
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_legal_provisions_embedding "
            "ON legal_provisions USING hnsw (embedding vector_cosine_ops);"
        ))
        print("HNSW cosine index ensured.")

        # Persist citations alongside each assistant message
        cols = [c["name"] for c in inspect(engine).get_columns("chat_messages")]
        if "legal_citations" not in cols:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN legal_citations TEXT;"))
            print("Added chat_messages.legal_citations.")
        else:
            print("chat_messages.legal_citations already exists.")

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
