"""
RecoverAI - Database Connection & Session Management
Using SQLite for local MVP, architected for PostgreSQL migration.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_default_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "recoverai.db")

raw_url = os.getenv("DATABASE_URL", "")
if raw_url and "sqlite" not in raw_url:
    # Use provided non-SQLite URL (e.g. PostgreSQL)
    DATABASE_URL = raw_url
    DB_PATH = None
else:
    # Use explicit sqlite path from env var, or default, or /tmp fallback
    if raw_url and raw_url.startswith("sqlite"):
        # Env var explicitly sets sqlite path
        path_part = raw_url.replace("sqlite:///", "")
        if not os.path.isabs(path_part):
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            DB_PATH = os.path.join(project_root, path_part)
        else:
            DB_PATH = path_part
        clean_path = DB_PATH.replace("\\", "/")
        DATABASE_URL = f"sqlite:///{clean_path}"
    else:
        # Try default local path; fall back to /tmp for read-only filesystems (Vercel)
        try:
            os.makedirs(os.path.dirname(_default_db_path), exist_ok=True)
            open(_default_db_path + ".probe", "a").close()
            os.remove(_default_db_path + ".probe")
            DB_PATH = _default_db_path
        except (OSError, PermissionError):
            DB_PATH = "/tmp/recoverai.db"
        clean_path = DB_PATH.replace("\\", "/")
        DATABASE_URL = f"sqlite:///{clean_path}"

# SQLite connection args for concurrent access
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
