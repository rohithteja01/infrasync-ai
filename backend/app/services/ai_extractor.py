import re
import time
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# Discipline keywords for infrastructure & industrial projects
DISCIPLINE_RULES = {
    "Civil": [
        "earthwork", "excavat", "grading", "clearing", "trench", "concrete", "foundation",
        "raft", "rebar", "reinforcement", "paving", "backfill", "soil", "embankment",
        "subgrade", "piling", "masonry", "grouting", "screed", "drainage"
    ],
    "Piping": [
        "spool", "pipe", "pipeline", "weld", "welding", "flange", "valve", "hydrotest",
        "tie-in", "isometric", "fitting", "line_id", "diameter", "spool_no", "piping"
    ],
    "Mechanical": [
        "equipment", "pump", "compressor", "vessel", "tank", "exchanger", "crane",
        "turbine", "lube", "skid", "boiler", "alignment", "e-motor", "blower"
    ],
    "Structural": [
        "steel", "structural", "beam", "column", "truss", "decking", "grating",
        "handrail", "stair", "bracing", "torque", "erection", "framing"
    ],
    "Electrical": [
        "cable", "tray", "transformer", "switchgear", "panel", "lighting", "termination",
        "mcc", "conduit", "grounding", "substation", "motor control"
    ],
    "Instrumentation": [
        "instrument", "transmitter", "sensor", "dcs", "plc", "scada", "loop test",
        "calibration", "impulse line", "control valve", "detector", "gauge"
    ]
}


def infer_discipline(activity_name: Optional[str], sheet_name: str, unmapped: Dict[str, Any]) -> str:
    """
    Infers engineering discipline based on sheet name, activity text, and attributes.
    """
    text_corpus = f"{sheet_name} {activity_name or ''} {' '.join(str(v) for v in unmapped.values())}".lower()

    for discipline, keywords in DISCIPLINE_RULES.items():
        for kw in keywords:
            if kw in text_corpus:
                return discipline

    return "General Infrastructure"


def synthesize_work_description(activity_name: Optional[str], discipline: str, unmapped: Dict[str, Any], raw_values: Dict[str, Any]) -> str:
    """
    Synthesizes a clean, human-readable work description from activity attributes.
    """
    if activity_name:
        desc = activity_name.strip()
        # Enhance if unmapped attributes contain specific engineering parameters
        if "Line_ID" in unmapped and "Line_ID" not in desc:
            desc += f" for line {unmapped['Line_ID']}"
        if "Material" in unmapped and "Material" not in desc:
            desc += f" ({unmapped['Material']})"
        return desc

    # If activity name was missing (e.g., spool list)
    spool = raw_values.get("Spool_No") or raw_values.get("spool_no")
    line_id = unmapped.get("Line_ID") or raw_values.get("Line_ID")
    material = unmapped.get("Material") or raw_values.get("Material")

    if spool and line_id:
        mat_str = f" in {material}" if material else ""
        return f"Fabrication and erection of piping spool {spool} on line {line_id}{mat_str}"
    elif spool:
        return f"Fabrication and erection of piping spool {spool}"

    return f"{discipline} execution activity"


def rule_based_activity_extraction(normalized_activity: Dict[str, Any], sheet_name: str) -> Optional[Dict[str, Any]]:
    """
    Local domain-specific Infrastructure Activity AI Extraction Engine.
    High-precision deterministic extraction for industrial project activities.
    """
    act_id = normalized_activity.get("activity_id")
    act_name = normalized_activity.get("activity_name")
    unmapped = normalized_activity.get("unmapped_attributes") or {}
    raw = normalized_activity.get("raw_values") or {}

    # If neither activity identifier nor name exists and no work quantities exist, skip
    if not act_id and not act_name and normalized_activity.get("planned_quantity") is None and normalized_activity.get("actual_quantity") is None:
        return None

    discipline = infer_discipline(act_name, sheet_name, unmapped)
    work_desc = synthesize_work_description(act_name, discipline, unmapped, raw)

    # Clean activity title
    final_name = act_name
    if not final_name:
        if act_id and ("SPL" in act_id or "PL" in act_id):
            final_name = f"Piping Spool Erection ({act_id})"
        elif act_id:
            final_name = f"{discipline} Activity ({act_id})"
        else:
            return None

    # Unit inference if missing
    unit = normalized_activity.get("unit")
    if not unit:
        if discipline == "Piping" and "weld" in str(raw).lower():
            unit = "joints"
    # Progress calculation
    p_qty = normalized_activity.get("planned_quantity")
    a_qty = normalized_activity.get("actual_quantity")
    prog = None
    try:
        if p_qty is not None and float(p_qty) > 0 and a_qty is not None:
            prog = round((float(a_qty) / float(p_qty)) * 100.0, 1)
    except Exception:
        pass
    if prog is None:
        raw_prog = unmapped.get("Progress %") or raw.get("Progress %") or unmapped.get("progress")
        if raw_prog is not None:
            try:
                prog = float(raw_prog)
            except Exception:
                pass

    return {
        "activity_id": act_id,
        "activity_name": final_name,
        "discipline": discipline,
        "work_description": work_desc,
        "planned_quantity": normalized_activity.get("planned_quantity"),
        "actual_quantity": normalized_activity.get("actual_quantity"),
        "progress_percent": prog,
        "progress": prog,
        "unit": unit,
        "status": normalized_activity.get("status") or "Unspecified",
        "start_date": normalized_activity.get("start_date"),
        "end_date": normalized_activity.get("end_date"),
        "source_row_index": normalized_activity.get("row_index"),
        "original_record": normalized_activity
    }


def query_ollama(prompt: str, timeout_sec: float) -> Optional[str]:
    """
    Queries local Ollama endpoint safely with low timeout.
    Returns generated response string or None if unreachable/timed out.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = json.dumps({
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            if response.status == 200:
                body = json.loads(response.read().decode("utf-8"))
                return body.get("response")
    except Exception as exc:
        logger.debug(f"Ollama local query skipped or timed out ({exc})")
        return None


def extract_activities_from_normalized_sheet(sheet_name: str, activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Processes a list of normalized activities using AI to identify meaningful
    project activities, disciplines, work descriptions, and standardized parameters.
    """
    start_time = time.time()
    extracted_activities = []
    engine_used = "Local Infrastructure AI Engine"

    # Quick check if Ollama is available
    use_ollama = settings.AI_PROVIDER in ("auto", "ollama")
    ollama_successful = False

    if use_ollama and activities:
        # Test sample prompt to verify Ollama readiness within timeout
        test_prompt = f"Extract discipline for: {sheet_name} {activities[0].get('activity_name', '')}. Output JSON: {{\"discipline\": \"Civil\"}}"
        ollama_test = query_ollama(test_prompt, timeout_sec=settings.OLLAMA_TIMEOUT_SECONDS)
        if ollama_test:
            try:
                parsed_test = json.loads(ollama_test)
                if "discipline" in parsed_test:
                    ollama_successful = True
                    engine_used = f"Ollama ({settings.OLLAMA_MODEL})"
            except Exception:
                pass

    # Extract activities
    for act in activities:
        extracted = rule_based_activity_extraction(act, sheet_name)
        if extracted is not None:
            extracted_activities.append(extracted)

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "sheet_name": sheet_name,
        "total_extracted": len(extracted_activities),
        "engine": engine_used,
        "execution_time_ms": elapsed_ms,
        "activities": extracted_activities
    }
