"""
Infrasync AI — Project PDF Report API Router
Provides endpoint for generating professional, printable PDF project reports
from the active, in-memory projectContext without re-running any extraction or AI pipelines.

Stateless, zero database mutations (database_modified: false).
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Response, Request
from pydantic import BaseModel
import reportlab

from app.services.pdf_report_generator import (
    generate_project_pdf_report,
    sanitize_filename_component
)

router = APIRouter()


class PDFReportRequest(BaseModel):
    project_context: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"


@router.get("/status", summary="Reports Service Status", tags=["Reports"])
def get_reports_status():
    """
    Returns reports generation engine status and version.
    Strictly read-only, zero database modifications.
    """
    return {
        "status": "ready",
        "engine": "ReportLab",
        "engine_version": getattr(reportlab, "__version__", "unknown"),
        "database_modified": False
    }


@router.post("/project-pdf", summary="Generate downloadable Project Intelligence PDF Report", tags=["Reports"])
async def generate_project_pdf_endpoint(request: Request):
    """
    Generates a professional, multi-page infrastructure engineering report PDF
    from the currently active project context without re-running any extraction,
    ASR, OCR, or schedule matching pipelines.

    Strict zero database mutations (database_modified: false).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload received."
        )

    # Allow payload to be either {"project_context": {...}} or direct projectContext dictionary
    context = None
    if isinstance(body, dict):
        if "project_context" in body and isinstance(body["project_context"], dict):
            context = body["project_context"]
        elif "activities" in body or "summary" in body or "files_processed" in body or "project_name" in body:
            context = body

    if not context or not isinstance(context, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active project context provided. Upload and process project data in Project Intelligence before generating a report."
        )

    # Validate that the context has actual project information
    has_files = bool(context.get("files_processed"))
    has_acts = bool(context.get("activities"))
    if not has_files and not has_acts and not context.get("project_name"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided project context contains no processed files or activities. Please process project data first."
        )

    # Generate PDF bytes via service
    try:
        pdf_bytes = generate_project_pdf_report(context)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate project PDF report: {str(exc)}"
        )

    # Build Windows-safe filename
    raw_name = context.get("project_name") or (
        context.get("files_processed")[0].get("filename") if context.get("files_processed") else "Project"
    )
    safe_name = sanitize_filename_component(raw_name)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"Infrasync_AI_Project_Report_{safe_name}_{timestamp}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    )
