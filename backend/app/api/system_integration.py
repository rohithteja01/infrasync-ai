from fastapi import APIRouter
from app.services.end_to_end_validation import run_all_integration_checks

router = APIRouter()


@router.get("/integration-status", summary="Get comprehensive SIH system integration health and check status", tags=["System Integration"])
def get_system_integration_status():
    """
    Returns verified status across all 34 canonical architecture pipeline stages.
    """
    return run_all_integration_checks()
