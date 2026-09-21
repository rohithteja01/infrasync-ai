import re
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple


# Synonyms and patterns for detecting standard activity fields
FIELD_CANDIDATES = {
    "activity_id": [
        "wbs_code", "wbs", "activity_id", "activity_code", "act_id", "act_code",
        "task_id", "task_code", "code", "id", "spool_no", "item_no", "item_code",
        "activity_number", "act_num"
    ],
    "activity_name": [
        "l6_activity", "l6_task", "l6_description", "l6_act", "executable_activity",
        "activity_name", "activity_desc", "activity_description", "description",
        "task_name", "task_description", "scope_description",
        "work_item", "work_description", "item_description", "activity", "title", "name", "scope"
    ],
    "planned_quantity": [
        "planned_qty", "planned_quantity", "planned_amount", "budget_qty",
        "target_qty", "boq_qty", "planned", "estimated_qty", "plan_qty", "quantity"
    ],
    "actual_quantity": [
        "actual_qty", "actual_quantity", "executed_qty", "completed_qty",
        "cumulative_qty", "progress_qty", "actual", "done_qty", "weld_joints"
    ],
    "unit": [
        "unit", "uom", "unit_of_measure", "measurement_unit", "metric", "unit_measure"
    ],
    "status": [
        "status", "activity_status", "state", "progress_status", "erection_status",
        "current_status", "stage", "task_status"
    ],
    "start_date": [
        "start_date", "planned_start", "actual_start", "commencement_date",
        "start", "start_time", "commenced", "commence_date"
    ],
    "end_date": [
        "end_date", "finish_date", "completion_date", "planned_finish",
        "actual_finish", "target_date", "finish", "end", "target_finish"
    ],
}


def normalize_header(header: str) -> str:
    """Standardizes column header: strips whitespace and converts to snake_case."""
    if not header:
        return ""
    # Strip whitespace
    cleaned = header.strip()
    # Replace symbols with underscore
    cleaned = re.sub(r'[\s\-\/\.\(\)]+', '_', cleaned)
    # Strip duplicate underscores
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    return cleaned.lower()


def clean_text(value: Any) -> Optional[str]:
    """Cleans text values, removes redundant whitespace and handles null indicators."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    val_str = str(value).strip()
    # Collapse multiple consecutive spaces
    val_str = re.sub(r'\s+', ' ', val_str)
    if not val_str or val_str.lower() in ("nan", "none", "null", "n/a", "-", "--", "nil"):
        return None
    return val_str


def clean_number(value: Any) -> Optional[float]:
    """Safely parses numeric quantities handling commas, signs, and strings."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        import math
        if math.isnan(value) or math.isinf(value):
            return None
        return float(value)
    val_str = str(value).strip().replace(',', '').replace('$', '').replace('%', '')
    if not val_str or val_str.lower() in ("nan", "none", "null", "n/a", "-", "nil"):
        return None
    try:
        val = float(val_str)
        return int(val) if val.is_integer() else val
    except ValueError:
        return None


def clean_status(value: Any) -> Optional[str]:
    """Standardizes common status labels while preserving custom domain values."""
    cleaned = clean_text(value)
    if not cleaned:
        return None
    lower = cleaned.lower()
    mapping = {
        "completed": "Completed",
        "complete": "Completed",
        "done": "Completed",
        "finished": "Completed",
        "in progress": "In Progress",
        "in-progress": "In Progress",
        "ongoing": "In Progress",
        "executing": "In Progress",
        "started": "In Progress",
        "planned": "Planned",
        "not started": "Planned",
        "pending": "Pending",
        "delayed": "Delayed",
        "behind": "Delayed",
        "on hold": "On Hold",
        "suspended": "On Hold",
        "cancelled": "Cancelled",
        "canceled": "Cancelled"
    }
    return mapping.get(lower, cleaned.title())


def detect_field_mapping(columns: List[str]) -> Dict[str, Optional[str]]:
    """
    Detects best matching original columns for each canonical activity field.
    Returns mapping: { canonical_field: original_column_name or None }
    """
    normalized_cols = {col: normalize_header(col) for col in columns}
    mapping: Dict[str, Optional[str]] = {canonical: None for canonical in FIELD_CANDIDATES}
    used_columns = set()

    # Prioritized match
    for canonical, candidates in FIELD_CANDIDATES.items():
        for original_col, norm_col in normalized_cols.items():
            if original_col in used_columns:
                continue
            # Exact candidate match
            if norm_col in candidates:
                mapping[canonical] = original_col
                used_columns.add(original_col)
                break

    # Secondary partial match for unmatched fields
    for canonical, candidates in FIELD_CANDIDATES.items():
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


def normalize_activity_sheet(sheet_name: str, columns: List[str], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Normalizes a single worksheet's rows into standard activity records.
    """
    field_mapping = detect_field_mapping(columns)
    detected_count = sum(1 for v in field_mapping.values() if v is not None)

    # Check if sheet contains recognizable activity or execution fields
    has_activity_fields = (
        field_mapping.get("activity_id") is not None
        or field_mapping.get("activity_name") is not None
        or field_mapping.get("planned_quantity") is not None
        or field_mapping.get("actual_quantity") is not None
    )

    # Non-activity metadata sheets (e.g. Project Info) have no activity fields detected
    if not has_activity_fields or detected_count == 0:
        return {
            "sheet_name": sheet_name,
            "total_records": 0,
            "detected_fields_count": detected_count,
            "field_mapping": field_mapping,
            "activities": []
        }

    normalized_activities = []

    for idx, row in enumerate(rows):
        raw_row = row or {}

        # Extract mapped canonical values
        orig_id_col = field_mapping.get("activity_id")
        orig_name_col = field_mapping.get("activity_name")
        orig_planned_col = field_mapping.get("planned_quantity")
        orig_actual_col = field_mapping.get("actual_quantity")
        orig_unit_col = field_mapping.get("unit")
        orig_status_col = field_mapping.get("status")
        orig_start_col = field_mapping.get("start_date")
        orig_end_col = field_mapping.get("end_date")

        act_id = clean_text(raw_row.get(orig_id_col)) if orig_id_col else None
        act_name = clean_text(raw_row.get(orig_name_col)) if orig_name_col else None
        planned_qty = clean_number(raw_row.get(orig_planned_col)) if orig_planned_col else None
        actual_qty = clean_number(raw_row.get(orig_actual_col)) if orig_actual_col else None
        unit = clean_text(raw_row.get(orig_unit_col)) if orig_unit_col else None
        status = clean_status(raw_row.get(orig_status_col)) if orig_status_col else None
        start_date = clean_text(raw_row.get(orig_start_col)) if orig_start_col else None
        end_date = clean_text(raw_row.get(orig_end_col)) if orig_end_col else None

        # Skip rows where neither activity identifier nor work quantities exist
        if not act_id and not act_name and planned_qty is None and actual_qty is None:
            continue

        # Fallback for activity_id if missing but act_name exists
        if not act_id and act_name:
            act_id = f"ACT-{idx + 1:03d}"

        # Unmapped attributes (all other columns)
        mapped_orig_cols = {col for col in field_mapping.values() if col is not None}
        unmapped_attributes = {
            col: clean_text(raw_row.get(col))
            for col in columns
            if col not in mapped_orig_cols and raw_row.get(col) is not None
        }

        normalized_record = {
            "row_index": idx + 1,
            "activity_id": act_id,
            "activity_name": act_name,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "status": status or "Unspecified",
            "start_date": start_date,
            "end_date": end_date,
            "unmapped_attributes": unmapped_attributes,
            "raw_values": {k: clean_text(v) for k, v in raw_row.items()}
        }
        normalized_activities.append(normalized_record)

    return {
        "sheet_name": sheet_name,
        "total_records": len(normalized_activities),
        "detected_fields_count": detected_count,
        "field_mapping": field_mapping,
        "activities": normalized_activities
    }
