from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from app.core.auth import require_roles

from app.services.validated_schedule_update import (
    evaluate_schedule_updates,
    get_update_summary,
    generate_pmis_update_preview
)

router = APIRouter()


@router.get("/validated-updates", summary="Get validated execution updates for schedule/PMIS", tags=["Schedule / PMIS Update"])
def list_validated_updates():
    """
    Returns eligible and blocked schedule updates based on multi-source execution validation.
    Never mutates baseline schedule file.
    """
    updates = evaluate_schedule_updates()
    summary = get_update_summary()
    return {
        "summary": summary,
        "updates": updates,
        "total": len(updates),
        "database_modified": False,
        "baseline_modified": False
    }


@router.get("/update-summary", summary="Get schedule update validation gate summary", tags=["Schedule / PMIS Update"])
def get_summary():
    """
    Returns aggregate metrics on eligible vs blocked updates.
    """
    return get_update_summary()


@router.post("/update-preview", summary="Generate simulated PMIS schedule update preview", tags=["Schedule / PMIS Update"])
def preview_pmis_update(current_user: dict = Depends(require_roles("PLANNER"))):
    """
    Generates a simulated Primavera P6 / MS Project update XML payload.
    Read-only preview; strictly never modifies the baseline schedule.
    """
    return generate_pmis_update_preview()
