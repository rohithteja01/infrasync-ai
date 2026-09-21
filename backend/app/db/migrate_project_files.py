import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

CREATE_PROJECT_FILES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS project_files (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL DEFAULT 'default_project',
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'project_file',
    mime_type VARCHAR(100),
    file_size BIGINT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_is_active ON project_files(is_active);
CREATE INDEX IF NOT EXISTS idx_project_files_uploaded_at ON project_files(uploaded_at DESC);
"""

def init_project_files_table() -> bool:
    """
    Idempotently creates the project_files table and indexes in PostgreSQL.
    Leaves all existing tables untouched.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(CREATE_PROJECT_FILES_TABLE_SQL))
            conn.commit()
        logger.info("Successfully verified/created project_files table in PostgreSQL.")
        return True
    except Exception as exc:
        logger.error(f"Failed to initialize project_files table: {exc}")
        return False

if __name__ == "__main__":
    success = init_project_files_table()
    print("Migration status:", "SUCCESS" if success else "FAILED")
