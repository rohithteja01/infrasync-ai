import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Union

# Baseline L5/L6 Schedule Activity Master Registry (from baseline_schedule.xlsx)
BASELINE_ACTIVITY_REGISTRY: Dict[str, Dict[str, str]] = {
    "CIV-L5-01": {"name": "Main Substructure Construction", "discipline": "Civil"},
    "CIV-L6-01": {"name": "Subgrade excavation and compaction", "discipline": "Civil"},
    "CIV-L6-02": {"name": "Foundation rebar fixing and shuttering", "discipline": "Civil"},
    "CIV-L6-03": {"name": "M25 grade raft concrete pouring", "discipline": "Civil"},
    "PIP-L5-01": {"name": "Process Header Piping Fabrication", "discipline": "Piping"},
    "PIP-L6-01": {"name": "12-inch carbon steel pipe spool pre-fabrication", "discipline": "Piping"},
    "PIP-L6-02": {"name": "Pipe spool fit-up and butt welding", "discipline": "Piping"},
    "PIP-L6-03": {"name": "Hydrostatic pressure testing (25 bar)", "discipline": "Piping"},
    "MEC-L5-01": {"name": "Compressor Package Mechanical Installation", "discipline": "Mechanical"},
    "MEC-L6-01": {"name": "Base plate grouting and alignment", "discipline": "Mechanical"},
    "MEC-L6-02": {"name": "Centrifugal compressor skid heavy rigging", "discipline": "Mechanical"},
    "MEC-L6-03": {"name": "Driver-compressor shaft laser alignment", "discipline": "Mechanical"},
}

BASELINE_ACTIVITIES = BASELINE_ACTIVITY_REGISTRY

# In-memory execution events storage (zero PostgreSQL writes)
_IN_MEMORY_EVENTS: List[Dict[str, Any]] = []

# Number word replacement for phonetic spoken normalization
WORD_TO_DIGIT = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
}


def _replace_number_words(text: str) -> str:
    """Replaces spoken number words like 'six' with digits '6'."""
    pattern = re.compile(r'\b(' + '|'.join(WORD_TO_DIGIT.keys()) + r')\b', re.IGNORECASE)
    return pattern.sub(lambda m: WORD_TO_DIGIT[m.group(0).lower()], text)


def normalize_activity_id(text: str) -> Optional[str]:
    """
    Normalizes spoken, written, and abbreviated activity references into standard L5/L6 codes.
    Examples:
    - 'Civil 6-01' -> 'CIV-L6-01'
    - 'Civil 6 01' -> 'CIV-L6-01'
    - 'Civil six one' -> 'CIV-L6-01'
    - 'CIV L6 01'  -> 'CIV-L6-01'
    - 'civ-l6-01'  -> 'CIV-L6-01'
    - 'Piping five two' -> 'PIP-L5-02'
    - 'Mechanical six three' -> 'MEC-L6-03'
    """
    if not text:
        return None

    raw = text.strip()
    s = _replace_number_words(raw)

    # Match standard structured patterns: CIV-L6-01, PIP-L5-01, etc.
    m_std = re.search(r'\b([A-Za-z]{3,4})[\s\-_]*L?([1-6])[\s\-_]*0?([0-9]{1,2})\b', s, re.IGNORECASE)
    if m_std:
        prefix = m_std.group(1).upper()
        if prefix in ("CIVIL", "CIV"):
            prefix = "CIV"
        elif prefix in ("PIPING", "PIPE", "PIP"):
            prefix = "PIP"
        elif prefix in ("MECHANICAL", "MECH", "MEC"):
            prefix = "MEC"
        elif prefix in ("ELECTRICAL", "ELEC", "ELE"):
            prefix = "ELE"

        level = m_std.group(2)
        num = int(m_std.group(3))
        return f"{prefix}-L{level}-{num:02d}"

    # Match phonetic/spoken patterns
    phonetic_map = [
        (r'\bCivil[\s\-_]*6[\s\-_]*0?([0-9]{1,2})\b', "CIV-L6"),
        (r'\bCivil[\s\-_]*5[\s\-_]*0?([0-9]{1,2})\b', "CIV-L5"),
        (r'\bPip(?:ing)?[\s\-_]*6[\s\-_]*0?([0-9]{1,2})\b', "PIP-L6"),
        (r'\bPip(?:ing)?[\s\-_]*5[\s\-_]*0?([0-9]{1,2})\b', "PIP-L5"),
        (r'\bMec(?:h|hanical)?[\s\-_]*6[\s\-_]*0?([0-9]{1,2})\b', "MEC-L6"),
        (r'\bMec(?:h|hanical)?[\s\-_]*5[\s\-_]*0?([0-9]{1,2})\b', "MEC-L5"),
        (r'\bEle(?:c|ctrical)?[\s\-_]*6[\s\-_]*0?([0-9]{1,2})\b', "ELE-L6"),
        (r'\bEle(?:c|ctrical)?[\s\-_]*5[\s\-_]*0?([0-9]{1,2})\b', "ELE-L5"),
    ]

    for pat, rep in phonetic_map:
        m = re.search(pat, s, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            return f"{rep}-{num:02d}"

    return None


def detect_event_type(text: str) -> Optional[str]:
    """
    Detects whether an execution update indicates a START or END event.
    Returns 'START', 'END', or None if ambiguous / absent.
    """
    if not text:
        return None

    clean = text.lower().strip()

    # Exclude negative / non-event statements
    if re.search(r'\b(not\s+started|not\s+finished|pending|waiting|cannot\s+start)\b', clean):
        return None

    is_start = bool(re.search(
        r'\b(start|started|starting|commence|commenced|commencing|begin|began|beginning|initiate|initiated|initiating|kickoff)\b',
        clean
    ))

    is_end = bool(re.search(
        r'\b(end|ended|ending|finish|finished|finishing|complete|completed|completing|stop|stopped|stopping|close|closed|closing|done|halt|halted)\b',
        clean
    ))

    if is_start and not is_end:
        return "START"
    if is_end and not is_start:
        return "END"

    return None


def extract_location(text: str) -> Optional[str]:
    """
    Extracts explicit location or site area if stated in the update.
    Example: 'Start CIV-L6-01 at Station 4' -> 'Station 4'
    """
    if not text:
        return None

    m = re.search(r'\b(?:at|location:?|in)\s+([A-Za-z0-9][A-Za-z0-9\s\-_]{1,40}?)(?:\s+(?:with|evidence|ref|on|by|\.|\,|$)|$)', text, re.IGNORECASE)
    if m:
        loc = m.group(1).strip()
        if loc.lower() not in ("start", "end", "station", "site", "the", "work", "progress"):
            return loc
    return None


def extract_evidence_id(text: str) -> Optional[str]:
    """
    Extracts referenced evidence identifier if stated in the update.
    Example: 'with evidence EVD-SAMPLE-CIV-01' -> 'EVD-SAMPLE-CIV-01'
    """
    if not text:
        return None

    m = re.search(r'\b(EVD-[A-Za-z0-9\-_]+)\b', text, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return None


def extract_discipline(text: str) -> Optional[str]:
    """
    Extracts engineering discipline if explicitly stated in text.
    """
    if not text:
        return None

    m = re.search(r'\b(Civil|Piping|Mechanical|Electrical|Instrumentation|HSE)\b', text, re.IGNORECASE)
    if m:
        return m.group(1).capitalize()
    return None


def parse_time_agent_message(
    message: str,
    event_type: Optional[str] = None,
    activity_id: Optional[str] = None,
    event_time: Optional[str] = None,
    timestamp: Optional[str] = None,
    discipline: Optional[str] = None,
    location: Optional[str] = None,
    evidence_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Parses natural language execution updates into a standardized execution event.
    Rejects clearly invalid / non-event messages.
    """
    raw_input = (message or "").strip()

    # Determine activity_id
    resolved_activity_id = None
    if activity_id:
        resolved_activity_id = normalize_activity_id(activity_id) or activity_id.strip().upper()
    if not resolved_activity_id:
        resolved_activity_id = normalize_activity_id(raw_input)

    if not resolved_activity_id:
        raise ValueError(f"Cannot identify a valid activity ID from update: '{raw_input}'. Please specify an activity like 'CIV-L6-01'.")

    # Determine event_type (START or END or COMPLETED)
    resolved_event_type = None
    if event_type:
        e_upper = event_type.strip().upper()
        if e_upper in ("START", "END", "COMPLETED", "UPDATE"):
            resolved_event_type = e_upper

    if not resolved_event_type:
        resolved_event_type = detect_event_type(raw_input)

    if not resolved_event_type:
        raise ValueError(f"Cannot determine event type (START or END) from update: '{raw_input}'.")

    # Resolve activity name & discipline from baseline registry or explicit input
    reg_entry = BASELINE_ACTIVITY_REGISTRY.get(resolved_activity_id, {})
    resolved_activity_name = reg_entry.get("name")
    baseline_matched = bool(reg_entry)

    resolved_discipline = discipline or extract_discipline(raw_input) or reg_entry.get("discipline")
    resolved_location = location or extract_location(raw_input)
    resolved_evidence_id = evidence_id or extract_evidence_id(raw_input)

    # Resolve event timestamp (respect explicit timestamp or event_time)
    explicit_ts = timestamp or event_time
    if explicit_ts and explicit_ts.strip():
        resolved_time = explicit_ts.strip()
    else:
        resolved_time = datetime.now(timezone.utc).isoformat()

    event_id = f"EVT-{resolved_event_type}-{resolved_activity_id}-{uuid.uuid4().hex[:6].upper()}"

    return {
        "event_id": event_id,
        "event_type": resolved_event_type,
        "activity_id": resolved_activity_id,
        "activity_name": resolved_activity_name,
        "baseline_matched": baseline_matched,
        "event_time": resolved_time,
        "timestamp": resolved_time,
        "discipline": resolved_discipline,
        "location": resolved_location,
        "source": "TIME_AGENT",
        "evidence_id": resolved_evidence_id,
        "confidence": 1.0,
        "raw_input": raw_input or f"{resolved_event_type} {resolved_activity_id}",
        "database_modified": False,
        "in_memory_only": True
    }


def calculate_duration_hours(start_time_iso: str, end_time_iso: str) -> Optional[float]:
    """Calculates actual duration in hours between two ISO timestamp strings or HH:MM strings."""
    if not start_time_iso or not end_time_iso:
        return None
    try:
        s_clean = str(start_time_iso).strip()
        e_clean = str(end_time_iso).strip()
        # If HH:MM format, e.g. "08:30" and "15:45"
        m_s = re.match(r"^(\d{1,2}):(\d{2})", s_clean)
        m_e = re.match(r"^(\d{1,2}):(\d{2})", e_clean)
        if m_s and m_e:
            s_mins = int(m_s.group(1)) * 60 + int(m_s.group(2))
            e_mins = int(m_e.group(1)) * 60 + int(m_e.group(2))
            diff = e_mins - s_mins
            if diff >= 0:
                return round(diff / 60.0, 2)

        # If full ISO format
        s_dt = datetime.fromisoformat(s_clean.replace("Z", "+00:00"))
        e_dt = datetime.fromisoformat(e_clean.replace("Z", "+00:00"))
        diff = (e_dt - s_dt).total_seconds()
        if diff >= 0:
            return round(diff / 3600.0, 2)
        return None
    except Exception:
        return None


def load_db_execution_events(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Loads execution events from the PostgreSQL execution_events table.
    Gracefully falls back to empty list if database is unreachable.
    """
    events = []
    try:
        from app.core.database import engine
        from sqlalchemy import text
        import json

        with engine.connect() as conn:
            query = "SELECT * FROM execution_events ORDER BY id ASC"
            params = {}
            if project_id:
                query = "SELECT * FROM execution_events WHERE project_id = :project_id ORDER BY id ASC"
                params = {"project_id": project_id}
            rows = conn.execute(text(query), params).fetchall()
            for r in rows:
                m = dict(r._mapping) if hasattr(r, "_mapping") else dict(r)
                ev_id = m.get("id")
                what = m.get("what") or ""
                act_name = m.get("activity_name") or what
                act_id = m.get("schedule_code") or m.get("schedule_activity_id") or act_name or ev_id
                s_time = m.get("start_time")
                e_time = m.get("end_time")
                d_str = m.get("date") or ""

                if s_time and e_time:
                    e_type = "COMPLETED"
                elif s_time and not e_time:
                    e_type = "START"
                elif not s_time and e_time:
                    e_type = "END"
                else:
                    e_type = "COMPLETED"

                ts = f"{d_str}T{s_time}:00Z" if d_str and s_time and ":" in str(s_time) else (d_str or s_time or datetime.now(timezone.utc).isoformat())

                ev_files = m.get("evidence_files")
                if isinstance(ev_files, str):
                    try:
                        ev_files = json.loads(ev_files)
                    except Exception:
                        ev_files = [ev_files]
                elif not isinstance(ev_files, list):
                    ev_files = [str(ev_files)] if ev_files else []

                ev_ref = ev_files[0] if ev_files else (m.get("evidence_type") or None)

                events.append({
                    "id": ev_id,
                    "event_id": ev_id,
                    "project_id": m.get("project_id") or "PRJ-OIL-2026-01",
                    "what": what,
                    "activity_id": act_id,
                    "activity_name": act_name,
                    "schedule_activity_id": m.get("schedule_activity_id"),
                    "schedule_code": m.get("schedule_code"),
                    "discipline": m.get("discipline"),
                    "start_time": s_time,
                    "end_time": e_time,
                    "date": d_str,
                    "event_time": ts,
                    "timestamp": ts,
                    "location": m.get("location"),
                    "evidence_type": m.get("evidence_type"),
                    "evidence_id": ev_ref,
                    "evidence_files": ev_files,
                    "time_agent": m.get("time_agent") or "Agent-Field-Sync",
                    "confidence": float(m.get("confidence") or 95.0),
                    "status": m.get("status") or "Auto Accepted",
                    "quantity_reported": m.get("quantity_reported"),
                    "crew_lead": m.get("crew_lead"),
                    "duration_hours": calculate_duration_hours(s_time, e_time) if (s_time and e_time) else None,
                    "actual_duration_hours": calculate_duration_hours(s_time, e_time) if (s_time and e_time) else None,
                    "event_type": e_type,
                    "raw_input": what,
                    "source": "POSTGRESQL",
                    "database_modified": False,
                    "in_memory_only": False,
                })
    except Exception:
        pass
    return events


def save_db_execution_event(event_dict: Dict[str, Any]) -> bool:
    """
    Persists an execution event record into the PostgreSQL execution_events table.
    Ensures foreign key safety for schedule_activity_id and project_id.
    """
    try:
        from app.core.database import engine
        from sqlalchemy import text
        import json

        ev_id = event_dict.get("id") or event_dict.get("event_id")
        if not ev_id:
            ev_id = f"EV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            event_dict["id"] = ev_id
            event_dict["event_id"] = ev_id

        prj_id = event_dict.get("project_id") or "PRJ-OIL-2026-01"
        raw_act_id = event_dict.get("schedule_activity_id") or event_dict.get("activity_id")

        # Foreign key check against activities table
        sched_act_id = None
        with engine.connect() as conn:
            p_chk = conn.execute(text("SELECT id FROM projects WHERE id = :p"), {"p": prj_id}).fetchone()
            if not p_chk:
                prj_id = "PRJ-OIL-2026-01"

            if raw_act_id:
                a_chk = conn.execute(text("SELECT id FROM activities WHERE id = :a"), {"a": str(raw_act_id)}).fetchone()
                if a_chk:
                    sched_act_id = a_chk[0]

        sched_code = event_dict.get("schedule_code") or event_dict.get("activity_id")
        what = event_dict.get("what") or event_dict.get("raw_input") or event_dict.get("message") or f"{event_dict.get('event_type', 'Execution')} {sched_code or ''}"
        act_name = event_dict.get("activity_name") or what
        disc = event_dict.get("discipline")
        loc = event_dict.get("location")
        s_time = event_dict.get("start_time")
        e_time = event_dict.get("end_time")
        d_str = event_dict.get("date") or datetime.now().strftime("%Y-%m-%d")

        ts = event_dict.get("timestamp") or event_dict.get("event_time")
        if ts and "T" in str(ts):
            time_part = str(ts).split("T")[1][:5]
            if event_dict.get("event_type") == "START" and not s_time:
                s_time = time_part
            elif event_dict.get("event_type") == "END" and not e_time:
                e_time = time_part
            if not d_str or d_str == datetime.now().strftime("%Y-%m-%d"):
                d_str = str(ts).split("T")[0]

        ev_type = event_dict.get("evidence_type") or "Field Update"
        ev_id_ref = event_dict.get("evidence_id")
        ev_files = event_dict.get("evidence_files") or ([ev_id_ref] if ev_id_ref else [])
        if isinstance(ev_files, str):
            ev_files = [ev_files]

        agent = event_dict.get("time_agent") or "Time-Agent-01"
        conf = float(event_dict.get("confidence") or 95.0)
        status_val = event_dict.get("status") or ("COMPLETED" if (s_time and e_time) else ("STARTED" if s_time else "Auto Accepted"))
        qty = event_dict.get("quantity_reported")
        crew = event_dict.get("crew_lead")

        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO execution_events (
                        id, project_id, what, activity_name, discipline,
                        start_time, end_time, date, location, evidence_type,
                        evidence_files, time_agent, schedule_activity_id, schedule_code,
                        confidence, status, quantity_reported, crew_lead, metadata_json
                    ) VALUES (
                        :id, :project_id, :what, :activity_name, :discipline,
                        :start_time, :end_time, :date, :location, :evidence_type,
                        :evidence_files, :time_agent, :schedule_activity_id, :schedule_code,
                        :confidence, :status, :quantity_reported, :crew_lead, :metadata_json
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        what = EXCLUDED.what,
                        end_time = COALESCE(EXCLUDED.end_time, execution_events.end_time),
                        status = EXCLUDED.status
                """),
                {
                    "id": ev_id,
                    "project_id": prj_id,
                    "what": what,
                    "activity_name": act_name,
                    "discipline": disc,
                    "start_time": s_time,
                    "end_time": e_time,
                    "date": d_str,
                    "location": loc,
                    "evidence_type": ev_type,
                    "evidence_files": json.dumps(ev_files),
                    "time_agent": agent,
                    "schedule_activity_id": sched_act_id,
                    "schedule_code": sched_code,
                    "confidence": conf,
                    "status": status_val,
                    "quantity_reported": qty,
                    "crew_lead": crew,
                    "metadata_json": json.dumps(event_dict)
                }
            )
        return True
    except Exception:
        return False


def pair_events(events: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Computes deterministic pairing of all captured START and END events per activity.
    Handles:
    - STARTED (Start recorded, waiting for End)
    - COMPLETED (Both Start and End recorded, duration computed)
    - WAITING_FOR_START (End recorded without Start)
    - DUPLICATE_EVENT (Multiple Starts or Ends detected)
    """
    if events is None:
        events = _IN_MEMORY_EVENTS

    activities_map: Dict[str, Dict[str, Any]] = {}

    for evt in events:
        act_id = evt["activity_id"]
        if act_id not in activities_map:
            activities_map[act_id] = {
                "activity_id": act_id,
                "activity_name": evt.get("activity_name"),
                "discipline": evt.get("discipline"),
                "location": evt.get("location"),
                "start_event": None,
                "end_event": None,
                "start_time": None,
                "end_time": None,
                "status": "NOT_STARTED",
                "duration_hours": None,
                "actual_duration_hours": None,
                "all_events": [],
                "has_duplicate": False
            }

        act_data = activities_map[act_id]
        act_data["all_events"].append(evt)

        # Update metadata if available
        if evt.get("discipline") and not act_data.get("discipline"):
            act_data["discipline"] = evt.get("discipline")
        if evt.get("location") and not act_data.get("location"):
            act_data["location"] = evt.get("location")
        if evt.get("activity_name") and not act_data.get("activity_name"):
            act_data["activity_name"] = evt.get("activity_name")

        e_type = evt.get("event_type")
        evt_time = evt.get("timestamp") or evt.get("event_time")
        s_time_field = evt.get("start_time")
        e_time_field = evt.get("end_time")

        # Check if single event is already completed with both start & end times
        if e_type == "COMPLETED" or (s_time_field and e_time_field):
            act_data["start_event"] = act_data["start_event"] or evt
            act_data["end_event"] = act_data["end_event"] or evt
            act_data["start_time"] = act_data["start_time"] or s_time_field or evt_time
            act_data["end_time"] = act_data["end_time"] or e_time_field or evt_time
            dur = calculate_duration_hours(act_data["start_time"], act_data["end_time"])
            if dur is not None:
                act_data["duration_hours"] = dur
                act_data["actual_duration_hours"] = dur
        elif e_type == "START":
            if act_data["start_event"] is not None:
                act_data["has_duplicate"] = True
            else:
                act_data["start_event"] = evt
                act_data["start_time"] = evt_time
        elif e_type == "END":
            if act_data["end_event"] is not None:
                act_data["has_duplicate"] = True
            else:
                act_data["end_event"] = evt
                act_data["end_time"] = evt_time

    # Compute status and durations
    result = []
    for act_id, data in activities_map.items():
        has_start = data["start_event"] is not None
        has_end = data["end_event"] is not None

        if data["has_duplicate"]:
            data["status"] = "DUPLICATE_EVENT"
            data["warning"] = "Duplicate start or end events detected for this activity."
        elif has_start and has_end:
            data["status"] = "COMPLETED"
            if data["duration_hours"] is None:
                s_time = data["start_event"].get("timestamp") or data["start_event"].get("event_time") or data["start_time"]
                e_time = data["end_event"].get("timestamp") or data["end_event"].get("event_time") or data["end_time"]
                dur = calculate_duration_hours(s_time, e_time)
                data["duration_hours"] = dur
                data["actual_duration_hours"] = dur
        elif has_start and not has_end:
            data["status"] = "STARTED"
        elif not has_start and has_end:
            data["status"] = "WAITING_FOR_START"

        result.append(data)

    return result


def get_paired_activity_summaries(include_db: bool = False) -> List[Dict[str, Any]]:
    """Returns paired activity summaries for all events (in memory and optionally from DB)."""
    return pair_events(get_all_events(include_db=include_db))


def record_execution_event(
    message: Union[str, Dict[str, Any]],
    event_type: Optional[str] = None,
    activity_id: Optional[str] = None,
    event_time: Optional[str] = None,
    timestamp: Optional[str] = None,
    discipline: Optional[str] = None,
    location: Optional[str] = None,
    evidence_id: Optional[str] = None,
    persist_db: bool = True,
    what: Optional[str] = None,
    activity_name: Optional[str] = None,
    schedule_code: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    date: Optional[str] = None,
    evidence_type: Optional[str] = None,
    evidence_files: Optional[Union[List[str], str]] = None,
    crew_lead: Optional[str] = None,
    quantity_reported: Optional[str] = None,
    project_id: Optional[str] = None,
) -> Union[Tuple[Dict[str, Any], Dict[str, Any]], Dict[str, Any]]:
    """
    Parses and records an execution event in memory and persists to PostgreSQL.
    If called with a pre-formed dictionary: stores it and returns event dict.
    If called with text: returns (event_dict, pairing_status_dict).
    """
    if isinstance(message, dict):
        event = dict(message)
        t = event.get("timestamp") or event.get("event_time") or datetime.now(timezone.utc).isoformat()
        event["timestamp"] = t
        event["event_time"] = t
        if "database_modified" not in event:
            event["database_modified"] = False
        if "in_memory_only" not in event:
            event["in_memory_only"] = True
        _IN_MEMORY_EVENTS.append(event)
        if persist_db:
            save_db_execution_event(event)
        return event

    if not event_type:
        if start_time and end_time:
            event_type = "COMPLETED"
        elif start_time and not end_time:
            event_type = "START"
        elif not start_time and end_time:
            event_type = "END"

    event = parse_time_agent_message(
        message=message,
        event_type=event_type,
        activity_id=activity_id or schedule_code,
        event_time=event_time,
        timestamp=timestamp,
        discipline=discipline,
        location=location,
        evidence_id=evidence_id
    )

    if what:
        event["what"] = what
    if activity_name:
        event["activity_name"] = activity_name
    if schedule_code:
        event["schedule_code"] = schedule_code
    if start_time:
        event["start_time"] = start_time
    if end_time:
        event["end_time"] = end_time
    if date:
        event["date"] = date
    if evidence_type:
        event["evidence_type"] = evidence_type
    if evidence_files:
        event["evidence_files"] = evidence_files
    if crew_lead:
        event["crew_lead"] = crew_lead
    if quantity_reported:
        event["quantity_reported"] = quantity_reported
    if project_id:
        event["project_id"] = project_id

    # If both start_time and end_time are provided, compute duration
    if event.get("start_time") and event.get("end_time"):
        dur = calculate_duration_hours(event["start_time"], event["end_time"])
        if dur is not None:
            event["duration_hours"] = dur
            event["actual_duration_hours"] = dur
            if not event_type:
                event["event_type"] = "COMPLETED"

    _IN_MEMORY_EVENTS.append(event)
    if persist_db:
        save_db_execution_event(event)

    paired_list = get_paired_activity_summaries(include_db=False)
    activity_summary = next(
        (p for p in paired_list if p["activity_id"] == event["activity_id"]),
        {}
    )

    return event, activity_summary


def get_all_events(include_db: bool = False) -> List[Dict[str, Any]]:
    """
    Returns all captured execution events.
    If include_db is True, merges PostgreSQL execution_events with in-memory events.
    If False, returns copy of in-memory events (for clean deterministic tests).
    """
    if not include_db:
        return list(_IN_MEMORY_EVENTS)

    db_events = load_db_execution_events()
    seen_ids = set()
    combined = []

    # First add in-memory events
    for e in _IN_MEMORY_EVENTS:
        eid = e.get("event_id") or e.get("id")
        seen_ids.add(eid)
        combined.append(e)

    # Then add DB events that were not overridden in memory
    for e in db_events:
        eid = e.get("event_id") or e.get("id")
        if eid not in seen_ids:
            seen_ids.add(eid)
            combined.append(e)

    return combined


def reset_events() -> int:
    """Clears all captured execution events in memory (used for clean testing)."""
    count = len(_IN_MEMORY_EVENTS)
    _IN_MEMORY_EVENTS.clear()
    return count
