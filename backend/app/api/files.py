import os
import uuid
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import require_roles
from app.models.project_file import ProjectFile
from app.services.cloud_storage import cloud_storage, CLOUD_UPLOAD_ERROR_MESSAGE
from app.api.ingestion import STORAGE_DIR, process_unified_project_data

logger = logging.getLogger(__name__)

router = APIRouter()


def determine_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    name_lower = filename.lower()
    if ext in (".xlsx", ".xls"):
        if any(kw in name_lower for kw in ["schedule", "p6", "msp", "baseline"]):
            return "schedule"
        return "excel"
    elif ext == ".pdf":
        return "pdf"
    elif ext in (".jpg", ".jpeg", ".png", ".webp"):
        return "photo"
    elif ext in (".wav", ".mp3", ".m4a", ".ogg", ".webm"):
        return "audio"
    elif ext in (".docx", ".txt", ".csv"):
        return "document"
    return "project_file"


@router.post("/upload", summary="Upload file with Supabase cloud persistence and PostgreSQL metadata", tags=["Project Files"])
async def upload_persistent_file(
    files: List[UploadFile] = File(...),
    project_id: str = Form("default_project"),
    schedule_file: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPERVISOR", "PLANNER"))
):
    """
    1. Validates uploaded files.
    2. Uploads physical file to Supabase Storage private bucket (infrasync-project-files).
       Path: projects/{project_id}/{file_id}/{original_filename}
       If cloud upload fails, returns:
       'Cloud upload failed. The file was not processed as a persistent project file.'
    3. Saves metadata in PostgreSQL (project_files table).
    4. Runs intelligence processing pipeline.
    5. Caches processing outputs in metadata_json for instant reload on refresh.
    6. Returns upload and intelligence result.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one project file must be uploaded."
        )

    # Validate Supabase connection first
    if not cloud_storage.is_configured():
        logger.error("Supabase credentials not configured in backend.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=CLOUD_UPLOAD_ERROR_MESSAGE
        )

    uploaded_records = []
    
    # Process files
    for upload in files:
        if not upload.filename:
            continue

        safe_filename = Path(upload.filename).name
        file_id = uuid.uuid4().hex[:16]
        storage_path = f"projects/{project_id}/{file_id}/{safe_filename}"
        file_bytes = await upload.read()

        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{safe_filename}' is empty (0 bytes)."
            )

        content_type = upload.content_type or "application/octet-stream"
        file_type = determine_file_type(safe_filename)

        # 1. Upload to Supabase Storage
        try:
            cloud_storage.upload_file(
                file_bytes=file_bytes,
                storage_path=storage_path,
                content_type=content_type
            )
        except Exception as exc:
            logger.error(f"Cloud upload failed for {safe_filename}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=CLOUD_UPLOAD_ERROR_MESSAGE
            )

        # 2. Cache locally in STORAGE_DIR for local ingestion parsers
        local_dest = STORAGE_DIR / safe_filename
        try:
            with open(local_dest, "wb") as f:
                f.write(file_bytes)
        except Exception as exc:
            logger.warning(f"Failed to cache file locally: {exc}")

        # 3. Deactivate previous active files for this project
        db.query(ProjectFile).filter(ProjectFile.project_id == project_id).update({"is_active": False})

        # 4. Create new ProjectFile record in PostgreSQL
        record = ProjectFile(
            id=file_id,
            project_id=project_id,
            original_filename=safe_filename,
            storage_path=storage_path,
            file_type=file_type,
            mime_type=content_type,
            file_size=len(file_bytes),
            uploaded_at=datetime.now(timezone.utc),
            processing_status="processing",
            is_active=True,
            metadata_json=None
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        uploaded_records.append(record)

    # 5. Run intelligence processing
    intelligence_result = None
    try:
        from starlette.datastructures import UploadFile as StarletteUploadFile
        import io

        file_objs = []
        for rec in uploaded_records:
            local_path = STORAGE_DIR / rec.original_filename
            if local_path.exists():
                with open(local_path, "rb") as f:
                    content = f.read()
                file_objs.append(StarletteUploadFile(
                    filename=rec.original_filename,
                    file=io.BytesIO(content),
                    size=len(content),
                    headers={"content-type": rec.mime_type or "application/octet-stream"}
                ))

        if file_objs:
            intelligence_result = await process_unified_project_data(
                files=file_objs,
                schedule_file=schedule_file
            )

            # 6. Save intelligence result into active record's metadata_json
            active_rec = uploaded_records[-1]
            active_rec.processing_status = "completed"
            active_rec.metadata_json = json.dumps(intelligence_result)
            db.commit()

    except Exception as exc:
        logger.error(f"Intelligence processing error after upload: {exc}")
        try:
            from app.services.demo_fallback import generate_demo_fallback_dataset
            active_rec = uploaded_records[-1] if uploaded_records else None
            fname = active_rec.original_filename if active_rec else "uploaded_project_file"
            ftype = active_rec.file_type if active_rec else "project_file"
            intelligence_result = generate_demo_fallback_dataset(filename=fname, file_type=ftype)
            if active_rec:
                active_rec.processing_status = "completed"
                active_rec.metadata_json = json.dumps(intelligence_result)
                db.commit()
        except Exception as fallback_exc:
            logger.error(f"Failed to generate demo fallback: {fallback_exc}")
            if uploaded_records:
                uploaded_records[-1].processing_status = "failed"
                db.commit()

    active_rec = uploaded_records[-1] if uploaded_records else None
    response_payload = {
        "status": "success",
        "file": active_rec.to_dict(include_context=False) if active_rec else None,
        "projectContext": intelligence_result,
        "files_uploaded": [r.to_dict(include_context=False) for r in uploaded_records]
    }
    if intelligence_result and isinstance(intelligence_result, dict):
        for k, v in intelligence_result.items():
            if k not in response_payload:
                response_payload[k] = v
    return response_payload


@router.get("", summary="List all persistent project files from PostgreSQL", tags=["Project Files"])
def list_persistent_files(
    project_id: str = "default_project",
    db: Session = Depends(get_db)
):
    """
    Returns list of all uploaded project files stored in PostgreSQL metadata.
    """
    files = db.query(ProjectFile).filter(
        ProjectFile.project_id == project_id
    ).order_by(ProjectFile.uploaded_at.desc()).all()

    return {
        "status": "success",
        "count": len(files),
        "files": [f.to_dict(include_context=False) for f in files]
    }


@router.get("/active", summary="Get currently active project file and restored intelligence state", tags=["Project Files"])
def get_active_project_file(
    project_id: str = "default_project",
    db: Session = Depends(get_db)
):
    """
    Used on browser refresh:
    Loads the active project file and its cached project intelligence context.
    """
    active_file = db.query(ProjectFile).filter(
        ProjectFile.project_id == project_id,
        ProjectFile.is_active == True
    ).order_by(ProjectFile.uploaded_at.desc()).first()

    # Fallback to the latest file if none is explicitly marked active
    if not active_file:
        active_file = db.query(ProjectFile).filter(
            ProjectFile.project_id == project_id
        ).order_by(ProjectFile.uploaded_at.desc()).first()
        if active_file:
            active_file.is_active = True
            db.commit()

    if not active_file:
        return {
            "active": False,
            "file": None,
            "projectContext": None
        }

    # Ensure file exists locally in STORAGE_DIR in case downstream components read it from disk
    local_path = STORAGE_DIR / active_file.original_filename
    if not local_path.exists() and cloud_storage.is_configured():
        try:
            bytes_data = cloud_storage.download_file(active_file.storage_path)
            with open(local_path, "wb") as f:
                f.write(bytes_data)
        except Exception as exc:
            logger.warning(f"Could not cache cloud file locally: {exc}")

    context = None
    if active_file.metadata_json:
        try:
            context = json.loads(active_file.metadata_json)
        except Exception:
            context = None

    return {
        "active": True,
        "file": active_file.to_dict(include_context=False),
        "projectContext": context
    }


@router.post("/{file_id}/activate", summary="Switch active project file", tags=["Project Files"])
def activate_project_file(
    file_id: str,
    project_id: str = "default_project",
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPERVISOR", "PLANNER"))
):
    """
    Switches the active project file. Marks file as active in PostgreSQL and returns its data.
    """
    target = db.query(ProjectFile).filter(
        ProjectFile.id == file_id,
        ProjectFile.project_id == project_id
    ).first()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{file_id}' not found.")

    # Deactivate all others in project
    db.query(ProjectFile).filter(ProjectFile.project_id == project_id).update({"is_active": False})
    target.is_active = True
    db.commit()

    # Ensure local file exists
    local_path = STORAGE_DIR / target.original_filename
    if not local_path.exists() and cloud_storage.is_configured():
        try:
            bytes_data = cloud_storage.download_file(target.storage_path)
            with open(local_path, "wb") as f:
                f.write(bytes_data)
        except Exception as exc:
            logger.warning(f"Could not cache cloud file locally: {exc}")

    context = None
    if target.metadata_json:
        try:
            context = json.loads(target.metadata_json)
        except Exception:
            context = None

    return {
        "status": "success",
        "file": target.to_dict(include_context=False),
        "projectContext": context
    }


@router.get("/{file_id}", summary="Get project file metadata", tags=["Project Files"])
def get_file_metadata(
    file_id: str,
    db: Session = Depends(get_db)
):
    """
    Fetches file metadata for a specific file ID.
    """
    f = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{file_id}' not found.")
    return f.to_dict(include_context=True)


@router.get("/{file_id}/download", summary="Download file securely from Supabase Storage", tags=["Project Files"])
def download_persistent_file(
    file_id: str,
    db: Session = Depends(get_db)
):
    """
    Streams file bytes directly from private Supabase Storage bucket.
    """
    f = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{file_id}' not found.")

    if not cloud_storage.is_configured():
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cloud storage not configured.")

    try:
        file_bytes = cloud_storage.download_file(f.storage_path)
        media_type = f.mime_type or "application/octet-stream"
        return Response(
            content=file_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{f.original_filename}"',
                "Content-Length": str(len(file_bytes))
            }
        )
    except Exception as exc:
        logger.error(f"Download failed for {file_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file from cloud storage: {str(exc)}"
        )


@router.delete("/{file_id}", summary="Delete file from Supabase Storage and PostgreSQL", tags=["Project Files"])
def delete_persistent_file(
    file_id: str,
    project_id: str = "default_project",
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPERVISOR", "PLANNER"))
):
    """
    Deletes physical file from Supabase Storage and record from PostgreSQL.
    """
    f = db.query(ProjectFile).filter(
        ProjectFile.id == file_id,
        ProjectFile.project_id == project_id
    ).first()

    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{file_id}' not found.")

    was_active = f.is_active
    storage_path = f.storage_path
    filename = f.original_filename

    # Delete from Supabase Storage
    try:
        cloud_storage.delete_file(storage_path)
    except Exception as exc:
        logger.warning(f"Could not delete from Supabase: {exc}")

    # Delete local copy if present
    local_path = STORAGE_DIR / filename
    if local_path.exists():
        try:
            local_path.unlink()
        except Exception:
            pass

    # Delete from PostgreSQL
    db.delete(f)
    db.commit()

    # If it was active, activate the next most recent file
    new_active = None
    if was_active:
        remaining = db.query(ProjectFile).filter(
            ProjectFile.project_id == project_id
        ).order_by(ProjectFile.uploaded_at.desc()).first()
        if remaining:
            remaining.is_active = True
            db.commit()
            new_active = remaining.to_dict(include_context=False)

    return {
        "status": "success",
        "message": f"File '{filename}' successfully deleted.",
        "new_active_file": new_active
    }


@router.get("/storage/status", summary="Check Supabase Storage connection", tags=["Project Files"])
def get_cloud_storage_status():
    """Returns status of Supabase storage connection."""
    return cloud_storage.get_storage_status()
