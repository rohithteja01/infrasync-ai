from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.auth import require_roles

from app.services.contradiction_detection import (
    get_all_contradictions,
    get_contradiction_by_id,
    get_contradictions_summary,
    get_all_audit_records,
    detect_contradictions,
    reset_contradictions
)

router = APIRouter()


@router.get("/contradictions/summary", summary="Get contradiction detection summary metrics", tags=["Validation & Governance"])
def get_summary():
    """
    Returns aggregate counts for contradictions by severity, planner review, and evidence status.
    """
    return get_contradictions_summary()


@router.get("/contradictions", summary="Get all detected execution contradictions", tags=["Validation & Governance"])
def list_contradictions():
    """
    Returns all detected execution contradictions across ingested field sources.
    Every contradiction is classified for PLANNER_REVIEW.
    Never modifies PostgreSQL or schedule baseline.
    """
    contradictions = get_all_contradictions()
    return {
        "total": len(contradictions),
        "contradictions": contradictions,
        "database_modified": False,
        "storage": "in-memory",
        "governance_status": "PLANNER_REVIEW"
    }


@router.get("/contradictions/{contradiction_id}", summary="Get specific contradiction details", tags=["Validation & Governance"])
def get_contradiction_detail(contradiction_id: str):
    """
    Returns one contradiction with evidence and audit history.
    """
    item = get_contradiction_by_id(contradiction_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contradiction with ID '{contradiction_id}' not found."
        )
    return item


@router.get("/audit-trail", summary="Get contradiction detection audit trail", tags=["Validation & Governance"])
def list_audit_trail():
    """
    Returns all in-memory audit trail records for detected contradictions.
    """
    records = get_all_audit_records()
    return {
        "total_records": len(records),
        "audit_trail": records,
        "database_modified": False,
        "storage": "in-memory"
    }


@router.post("/contradictions/scan", summary="Trigger contradiction detection scan", tags=["Validation & Governance"])
def trigger_scan(current_user: dict = Depends(require_roles("PLANNER"))):
    """
    Runs a deterministic contradiction detection scan across all execution facts.
    """
    results = detect_contradictions()
    summary = get_contradictions_summary()
    return {
        "status": "success",
        "scanned_contradictions": len(results),
        "summary": summary,
        "database_modified": False
    }


@router.post("/contradictions/reset", summary="Reset in-memory contradictions (for testing)", tags=["Validation & Governance"])
def reset_scan():
    """
    Resets in-memory contradictions and audit records.
    """
    reset_contradictions()
    return {
        "status": "success",
        "message": "In-memory contradictions and audit trail reset.",
        "database_modified": False
    }
