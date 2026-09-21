import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

CREATE_PROFILES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
"""

def init_user_profiles_table() -> bool:
    """
    Idempotently creates the profiles table and indexes in PostgreSQL.
    Leaves all existing tables untouched.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(CREATE_PROFILES_TABLE_SQL))
            conn.commit()
        logger.info("Successfully verified/created profiles table in PostgreSQL.")
        return True
    except Exception as exc:
        logger.error(f"Failed to initialize profiles table: {exc}")
        return False

if __name__ == "__main__":
    success = init_user_profiles_table()
    print("User profiles migration status:", "SUCCESS" if success else "FAILED")
