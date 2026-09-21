from typing import Optional, List, Dict, Any, Union
from pathlib import Path
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from app.core.auth import require_roles

from app.services.time_agent import (
    record_execution_event,
    get_all_events,
    get_paired_activity_summaries,
    reset_events,
    parse_time_agent_message
)

router = APIRouter()
STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


class TimeAgentEventRequest(BaseModel):
    message: Optional[str] = Field(None, description="Natural language execution update, e.g. 'Start CIV-L6-01 at Station 4'")
    text: Optional[str] = Field(None, description="Alternative field for execution update message")
    what: Optional[str] = Field(None, description="Execution work description (What)")
    event_type: Optional[str] = Field(None, description="Explicit event type: 'START' or 'END'")
    activity_id: Optional[str] = Field(None, description="Explicit activity ID, e.g. 'CIV-L6-01'")
    activity_name: Optional[str] = Field(None, description="Explicit activity name")
    schedule_code: Optional[str] = Field(None, description="Schedule code reference")
    event_time: Optional[str] = Field(None, description="Explicit ISO timestamp")
    timestamp: Optional[str] = Field(None, description="Alternative field for ISO timestamp")
    start_time: Optional[str] = Field(None, description="Execution start time (When), e.g. '08:00' or ISO")
    end_time: Optional[str] = Field(None, description="Execution end time, e.g. '16:30' or ISO")
    date: Optional[str] = Field(None, description="Execution date, e.g. '2026-03-01'")
    discipline: Optional[str] = Field(None, description="Explicit discipline, e.g. 'Civil'")
    location: Optional[str] = Field(None, description="Site work location (Where)")
    evidence_id: Optional[str] = Field(None, description="Associated evidence ID reference")
    evidence_type: Optional[str] = Field(None, description="Type of evidence, e.g. 'Daily Progress Report'")
    evidence_files: Optional[Union[List[str], str]] = Field(None, description="Evidence file references")
    crew_lead: Optional[str] = Field(None, description="Field supervisor / crew lead name")
    quantity_reported: Optional[str] = Field(None, description="Reported quantity installed / executed")
    project_id: Optional[str] = Field(None, description="Project ID")


@router.get("/time-agent/status", summary="Get Time Agent service status", tags=["Time Agent"])
@router.get("/status", summary="Get execution service status", tags=["Execution Capture"])
def get_time_agent_status():
    """
    Returns operational status of the Time Agent service.
    """
    events = get_all_events(include_db=False)
    return {
        "service": "time-agent",
        "feature": "Time Agent & Start/End Execution Events",
        "status": "available",
        "storage": "in-memory-and-postgresql",
        "database_modified": False,
        "total_events_captured": len(events)
    }


@router.post("/time-agent/event", summary="Record structured execution event from supervisor update", tags=["Time Agent"])
@router.post("/event", summary="Record execution event", tags=["Execution Capture"])
def create_time_agent_event(
    req: TimeAgentEventRequest,
    current_user: dict = Depends(require_roles("SUPERVISOR", "PLANNER"))
):
    """
    Parses natural language execution updates or structured parameters into START/END execution events.
    Pairs events per activity and computes duration.
    Persists events to PostgreSQL execution_events table and in-memory.
    """
    input_text = (req.message or req.text or req.what or "").strip()
    if not input_text:
        if req.activity_id or req.schedule_code or req.activity_name:
            e_type = (req.event_type or "Record").capitalize()
            target = req.activity_id or req.schedule_code or req.activity_name
            input_text = f"{e_type} {target}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message or activity information cannot be empty. Please provide an execution update."
            )

    try:
        event, activity_summary = record_execution_event(
            message=input_text,
            event_type=req.event_type,
            activity_id=req.activity_id or req.schedule_code,
            event_time=req.event_time,
            timestamp=req.timestamp,
            discipline=req.discipline,
            location=req.location,
            evidence_id=req.evidence_id,
            what=req.what,
            activity_name=req.activity_name,
            schedule_code=req.schedule_code or req.activity_id,
            start_time=req.start_time,
            end_time=req.end_time,
            date=req.date,
            evidence_type=req.evidence_type,
            evidence_files=req.evidence_files,
            crew_lead=req.crew_lead,
            quantity_reported=req.quantity_reported,
            project_id=req.project_id
        )

        return {
            "status": "success",
            "success": True,
            "message": f"{event.get('event_type', 'Execution')} event registered for activity {event.get('activity_id', 'Unknown')}",
            "event": event,
            "activity_summary": activity_summary,
            "database_modified": False,
            "in_memory_only": True
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering execution event: {str(exc)}"
        )


@router.get("/time-agent/events", summary="Get all captured execution events and paired activities", tags=["Time Agent"])
def list_time_agent_events(include_db: bool = False):
    """
    Returns captured execution events and their paired activity summaries.
    Defaults to in-memory events for deterministic regression tests, or merges DB records when include_db=True.
    """
    events = get_all_events(include_db=include_db)
    paired = get_paired_activity_summaries(include_db=include_db)

    return {
        "total_events": len(events),
        "events": events,
        "paired_activities": paired,
        "total_activities": len(paired),
        "database_modified": False,
        "in_memory_only": not include_db
    }


@router.get("/events", summary="Get all execution events including database and in-memory", tags=["Execution Capture"])
def list_execution_events(include_db: bool = True):
    """
    Returns all captured execution events (from PostgreSQL execution_events and in-memory) and paired activities.
    """
    events = get_all_events(include_db=include_db)
    paired = get_paired_activity_summaries(include_db=include_db)

    return {
        "total_events": len(events),
        "events": events,
        "paired_activities": paired,
        "total_activities": len(paired),
        "database_modified": False,
        "in_memory_only": False
    }


@router.post("/time-agent/reset", summary="Reset captured execution events in memory", tags=["Time Agent"])
@router.post("/reset", summary="Reset captured execution events in memory", tags=["Execution Capture"])
def reset_time_agent_events():
    """
    Clears all captured execution events from memory.
    """
    cleared = reset_events()
    return {
        "status": "success",
        "message": f"Cleared {cleared} in-memory event(s).",
        "cleared_count": cleared,
        "database_modified": False
    }


@router.post("/time-agent/voice-event", summary="Process spoken execution update via existing Faster-Whisper ASR", tags=["Time Agent"])
async def create_voice_time_agent_event(
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    evidence_id: Optional[str] = Form(None),
    current_user: dict = Depends(require_roles("SUPERVISOR", "PLANNER"))
):
    """
    Optional ASR Bridge: Reuses existing Feature 2.30 Faster-Whisper ASR engine to transcribe
    spoken supervisor updates and passes the transcript to the Time Agent parser.
    """
    audio_path = None

    if file and file.filename:
        safe_filename = Path(file.filename).name
        audio_path = STORAGE_DIR / safe_filename
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")
        with open(audio_path, "wb") as f:
            f.write(content)
    elif filename:
        safe_filename = Path(filename).name
        audio_path = STORAGE_DIR / safe_filename
        if not audio_path.exists() or not audio_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Audio file '{safe_filename}' not found.")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide an audio file or filename.")

    # Run existing Feature 2.30 ASR
    from app.services.asr import run_asr
    asr_res = run_asr(audio_path)
    transcript = asr_res.get("text", "").strip()
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No speech detected in audio file for Time Agent processing."
        )

    try:
        event, activity_summary = record_execution_event(
            message=transcript,
            location=location,
            evidence_id=evidence_id
        )
        return {
            "status": "success",
            "asr_transcript": transcript,
            "event": event,
            "activity_summary": activity_summary,
            "database_modified": False,
            "in_memory_only": True
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ASR transcribed: '{transcript}', but Time Agent could not extract valid event: {str(val_err)}"
        )
