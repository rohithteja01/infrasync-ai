import re
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from pathlib import Path


# Synonyms and patterns for detecting standard schedule fields
SCHEDULE_FIELD_CANDIDATES = {
    "activity_id": [
        "activity_id", "activity_code", "act_id", "act_code", "task_id",
        "task_code", "code", "id", "activity_number", "act_num",
        "l6_id", "l5_id"
    ],
    "activity_name": [
        "l6_activity", "activity_name", "task_name", "activity_description", "description",
        "task_desc", "task", "activity", "name", "work_description", "scope_description",
        "l5_activity"
    ],
    "wbs": [
        "wbs", "wbs_code", "wbs_element", "work_breakdown_structure", "wbs_number", "wbs_id"
    ],
    "level": [
        "level", "schedule_level", "activity_level", "wbs_level", "hierarchical_level", "lvl"
    ],
    "planned_start": [
        "planned_start", "start_date", "target_start", "early_start",
        "baseline_start", "start", "commencement_date"
    ],
    "planned_finish": [
        "planned_finish", "planned_end", "finish_date", "end_date", "target_finish",
        "target_end", "early_finish", "baseline_finish", "finish", "end", "completion_date"
    ],
    "duration": [
        "duration", "duration_days", "planned_duration", "original_duration",
        "dur", "days", "duration_d"
    ],
    "discipline": [
        "discipline", "trade", "department", "engineering_discipline", "disc", "package"
    ],
    "predecessors": [
        "predecessors", "predecessor", "predecessor_id", "pred", "dependencies",
        "predecessor_ids", "depends_on"
    ]
}



def normalize_header(header: str) -> str:
    """Standardizes column header: strips whitespace and converts to snake_case."""
    if not header:
        return ""
    cleaned = header.strip()
    cleaned = re.sub(r'[\s\-\/\.\(\)]+', '_', cleaned)
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    return cleaned.lower()


def clean_text(value: Any) -> Optional[str]:
    """Cleans text values, removes redundant whitespace, and handles null indicators."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    val_str = str(value).strip()
    val_str = re.sub(r'\s+', ' ', val_str)
    if not val_str or val_str.lower() in ("nan", "none", "null", "n/a", "-", "--", "nil"):
        return None
    return val_str


def normalize_schedule_level(raw_level: Any) -> str:
    """
    Identifies whether a schedule activity is L5, L6, or another level.
    Accepts representations like 'L5', 'Level 5', '5', 'L-5', 'L6', '6', etc.
    """
    cleaned = clean_text(raw_level)
    if not cleaned:
        return "Unspecified"

    cleaned_upper = cleaned.upper()
    # Check for L5
    if re.search(r'\bL[\s\-_]?5\b', cleaned_upper) or re.search(r'\bLEVEL[\s\-_]?5\b', cleaned_upper) or cleaned_upper == "5":
        return "L5"
    # Check for L6
    if re.search(r'\bL[\s\-_]?6\b', cleaned_upper) or re.search(r'\bLEVEL[\s\-_]?6\b', cleaned_upper) or cleaned_upper == "6":
        return "L6"
    # Check for other levels (L1 - L4)
    match_other = re.search(r'\bL(?:EVEL)?[\s\-_]?([1-4])\b', cleaned_upper)
    if match_other:
        return f"L{match_other.group(1)}"
    if cleaned_upper in ("1", "2", "3", "4"):
        return f"L{cleaned_upper}"

    return cleaned


def format_duration(value: Any) -> Optional[str]:
    """Formats duration value into a clean, readable string (e.g. '41 days')."""
    if value is None:
        return None
    cleaned = clean_text(value)
    if not cleaned:
        return None
    # If already contains 'day' or 'd' or 'hrs'
    if re.search(r'(day|d|hr|hour|wk|week)', cleaned, re.IGNORECASE):
        return cleaned
    try:
        val_float = float(cleaned)
        val_int = int(val_float) if val_float.is_integer() else val_float
        return f"{val_int} days" if val_int != 1 else "1 day"
    except ValueError:
        return cleaned


def detect_schedule_field_mapping(columns: List[str]) -> Dict[str, Optional[str]]:
    """
    Detects best matching original columns for each canonical schedule field.
    Returns mapping: { canonical_field: original_column_name or None }
    """
    normalized_cols = {col: normalize_header(col) for col in columns}
    mapping: Dict[str, Optional[str]] = {canonical: None for canonical in SCHEDULE_FIELD_CANDIDATES}
    used_columns = set()

    # Exact candidate matches (in order of candidate priority)
    for canonical, candidates in SCHEDULE_FIELD_CANDIDATES.items():
        for candidate in candidates:
            found = False
            for original_col, norm_col in normalized_cols.items():
                if original_col in used_columns:
                    continue
                if norm_col == candidate:
                    mapping[canonical] = original_col
                    used_columns.add(original_col)
                    found = True
                    break
            if found:
                break

    # Partial / substring matches
    for canonical, candidates in SCHEDULE_FIELD_CANDIDATES.items():
        if mapping[canonical] is not None:
            continue
        for original_col, norm_col in normalized_cols.items():
            if original_col in used_columns:
                continue
            for candidate in candidates:
                if candidate in norm_col or norm_col in candidate:
                    mapping[canonical] = original_col
                    used_columns.add(original_col)
                    break
            if mapping[canonical] is not None:
                break

    return mapping


def parse_schedule_activities(sheet_name: str, columns: List[str], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extracts and standardizes schedule activities from a parsed worksheet.
    Classifies L5 / L6 activities and tallies summary counts.
    Supports both traditional schedules and combined progress matrices with L5/L6 columns.
    """
    field_mapping = detect_schedule_field_mapping(columns)
    normalized_cols_map = {normalize_header(col): col for col in columns}
    
    # Check for presence of L6/L5 specific columns
    has_l6_col = "l6_activity" in normalized_cols_map or any("l6" in k for k in normalized_cols_map)
    l5_id_col = normalized_cols_map.get("l5_id")
    l5_act_col = normalized_cols_map.get("l5_activity")
    l6_act_col = normalized_cols_map.get("l6_activity")
    distinct_l5 = set()

    activities = []
    l5_count = 0
    l6_count = 0
    other_count = 0

    id_col = field_mapping.get("activity_id")
    name_col = field_mapping.get("activity_name")
    wbs_col = field_mapping.get("wbs")
    level_col = field_mapping.get("level")
    start_col = field_mapping.get("planned_start")
    finish_col = field_mapping.get("planned_finish")
    duration_col = field_mapping.get("duration")
    discipline_col = field_mapping.get("discipline")
    pred_col = field_mapping.get("predecessors")

    for idx, row in enumerate(rows):
        raw_row = row or {}

        act_id = clean_text(raw_row.get(id_col)) if id_col else None
        act_name = clean_text(raw_row.get(name_col)) if name_col else None
        wbs = clean_text(raw_row.get(wbs_col)) if wbs_col else None
        raw_level = clean_text(raw_row.get(level_col)) if level_col else None
        
        # Determine level: if explicit level column, use it; else if L6 column present, classify as L6
        if level_col and raw_level:
            level = normalize_schedule_level(raw_level)
        elif has_l6_col:
            level = "L6"
            raw_level = "L6"
        else:
            level = normalize_schedule_level(raw_level)

        # Track L5 packages if available
        if l5_id_col:
            val_l5 = clean_text(raw_row.get(l5_id_col))
            if val_l5:
                distinct_l5.add(val_l5)
        elif l5_act_col:
            val_l5 = clean_text(raw_row.get(l5_act_col))
            if val_l5:
                distinct_l5.add(val_l5)

        # Fallback WBS to L5 activity if WBS column is missing
        if (not wbs or wbs == "-") and l5_act_col:
            wbs = clean_text(raw_row.get(l5_act_col))

        planned_start = clean_text(raw_row.get(start_col)) if start_col else None
        planned_finish = clean_text(raw_row.get(finish_col)) if finish_col else None
        duration = format_duration(raw_row.get(duration_col)) if duration_col else None
        discipline = clean_text(raw_row.get(discipline_col)) if discipline_col else "General"
        predecessors = clean_text(raw_row.get(pred_col)) if pred_col else None

        # Fallback for activity ID if missing
        if not act_id and act_name:
            act_id = f"SCHED-{idx + 1:03d}"

        # Count levels
        if level == "L5":
            l5_count += 1
        elif level == "L6":
            l6_count += 1
        else:
            other_count += 1

        activity_record = {
            "index": idx + 1,
            "activity_id": act_id or f"SCHED-{idx + 1:03d}",
            "activity_name": act_name or f"Activity {idx + 1}",
            "wbs": wbs or "-",
            "level": level,
            "raw_level": raw_level or "-",
            "planned_start": planned_start or "-",
            "planned_finish": planned_finish or "-",
            "duration": duration or "-",
            "discipline": discipline or "General",
            "predecessors": predecessors or "-",
            "l5_id": clean_text(raw_row.get(l5_id_col)) if l5_id_col else None,
            "l5_activity": clean_text(raw_row.get(l5_act_col)) if l5_act_col else None,
            "l6_activity": clean_text(raw_row.get(l6_act_col)) if l6_act_col else None,
            "raw_values": {k: clean_text(v) for k, v in raw_row.items()}
        }
        activities.append(activity_record)

    # When sheet consists of L6 items grouped under L5 packages
    if has_l6_col and distinct_l5:
        l5_count = len(distinct_l5)
        l6_count = len([a for a in activities if a["level"] == "L6"])
        other_count = len(activities) - l6_count

    return {
        "sheet_name": sheet_name,
        "total_schedule_activities": len(activities),
        "l5_count": l5_count,
        "l6_count": l6_count,
        "other_count": other_count,
        "field_mapping": field_mapping,
        "activities": activities
    }

