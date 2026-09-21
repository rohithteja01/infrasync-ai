import logging
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLAlchemy Declarative Base
Base = declarative_base()

# SQLAlchemy Engine
# pool_pre_ping enables automatic reconnection health checks
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"connect_timeout": 3} if settings.DATABASE_URL.startswith("postgresql") else {}
)

# Session Local factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy database session
    and ensures clean closure after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> Dict[str, Any]:
    """
    Health check utility to verify PostgreSQL connectivity.
    Returns status and message without throwing unhandled exceptions.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "message": "PostgreSQL database is connected and responding."
        }
    except Exception as exc:
        logger.warning(f"Database connection check failed: {exc}")
        return {
            "status": "disconnected",
            "message": f"Database unreachable ({exc.__class__.__name__}). Ensure PostgreSQL is running."
        }
