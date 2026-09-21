from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.core.database import check_db_connection

router = APIRouter()


@router.get("/health", summary="Health check", tags=["System"])
def get_health():
    """
    Returns system health status, service metadata, and database connectivity.
    """
    db_health = check_db_connection()
    
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_health
    }
