from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load .env HERE, before reading DATABASE_URL. database.py is imported before
# main.py calls load_dotenv(), so without this the engine would be built from
# the default (SQLite) and ignore the configured Postgres/Supabase URL.
load_dotenv()

# Database URL. Defaults to local SQLite; set DATABASE_URL to a Supabase/Postgres
# connection string to use Postgres (e.g. postgresql://postgres:<pwd>@<host>:5432/postgres?sslmode=require)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ethiolex.db")

_is_sqlite = DATABASE_URL.startswith("sqlite")

# Create engine.
# - SQLite: allow cross-thread use (FastAPI runs handlers in a threadpool).
# - Postgres (Supabase): pool_pre_ping avoids errors from connections the
#   Supabase pooler has closed; a modest pool keeps things responsive.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=not _is_sqlite,
    pool_recycle=300 if not _is_sqlite else -1,
)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()