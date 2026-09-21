from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, status

from app.services.institutional_memory import (
    get_all_memory_records,
    get_institutional_memory_summary,
    get_memory_record_by_activity,
    get_memory_records_by_discipline
)

router = APIRouter()


@router.get("", summary="Get all institutional memory records", tags=["Institutional Memory"])
def list_memory_records():
    """
    Returns historical execution knowledge records including actual durations,
    productivity patterns, delay causes, and bottlenecks for current project.
    """
    records = get_all_memory_records()
    summary = get_institutional_memory_summary()
    return {
        "records": records,
        "summary": summary,
        "total": len(records),
        "database_modified": False,
        "storage": "in-memory"
    }


@router.get("/summary", summary="Get institutional memory summary statistics", tags=["Institutional Memory"])
def get_summary():
    """
    Returns discipline performance and productivity benchmarks.
    """
    return get_institutional_memory_summary()


@router.get("/activity/{activity_id}", summary="Get institutional memory for a specific activity", tags=["Institutional Memory"])
def get_activity_memory(activity_id: str):
    """
    Returns memory record for a specific activity ID.
    """
    rec = get_memory_record_by_activity(activity_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No institutional memory record found for activity '{activity_id}'."
        )
    return rec


@router.get("/discipline/{discipline}", summary="Get institutional memory records for a discipline", tags=["Institutional Memory"])
def get_discipline_memory(discipline: str):
    """
    Returns memory records filtered by discipline (e.g. Civil, Piping, Mechanical).
    """
    records = get_memory_records_by_discipline(discipline)
    return {
        "discipline": discipline,
        "total": len(records),
        "records": records,
        "database_modified": False
    }
