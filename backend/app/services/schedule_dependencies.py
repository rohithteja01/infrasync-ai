import re
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id


def parse_dependency_token(token: str) -> Dict[str, str]:
    """
    Parses a single predecessor token, e.g. 'CIV-L6-01', 'CIV-L6-01FS', 'CIV-L6-01 (FS)'.
    Extracts the clean activity ID and the canonical relationship type.
    Supported types: FINISH_TO_START (FS), START_TO_START (SS), FINISH_TO_FINISH (FF), START_TO_FINISH (SF).
    Default: FINISH_TO_START.
    """
    cleaned = (token or "").strip()
    dep_type = "FINISH_TO_START"

    # Match trailing or parenthesized relationship type: FS, SS, FF, SF
    match = re.search(r'[\(\s\-_]*(FS|SS|FF|SF)[\)\s]*$', cleaned, re.IGNORECASE)
    if match:
        tag = match.group(1).upper()
        if tag == "FS":
            dep_type = "FINISH_TO_START"
        elif tag == "SS":
            dep_type = "START_TO_START"
        elif tag == "FF":
            dep_type = "FINISH_TO_FINISH"
        elif tag == "SF":
            dep_type = "START_TO_FINISH"
        raw_id = cleaned[:match.start()].strip()
    else:
        raw_id = cleaned

    return {
        "predecessor_id": raw_id,
        "dependency_type": dep_type
    }


def get_schedule_dependencies(
    schedule_activities: List[Dict[str, Any]],
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.15: Schedule Dependencies Service.
    Parses baseline schedule relationships (Predecessor -> Successor).
    Validates referenced activity IDs against baseline schedule activities.
    Classifies VALID and INVALID dependencies deterministically.
    Purely read-only analytical representation (no database writes or schedule mutations).
    """
    # 1. Index baseline schedule activities by normalized ID
    sched_by_id: Dict[str, Dict[str, Any]] = {}
    for act in schedule_activities:
        aid = normalize_id(act.get("activity_id"))
        if aid:
            sched_by_id[aid] = act

    dependencies: List[Dict[str, Any]] = []
    valid_count = 0
    invalid_count = 0

    # 2. Iterate each schedule activity (the Successor)
    for act in schedule_activities:
        succ_id = act.get("activity_id") or ""
        norm_succ_id = normalize_id(succ_id)
        succ_name = act.get("activity_name") or "Unnamed Activity"
        succ_level = act.get("level") or "L6"
        succ_wbs = act.get("wbs") or "-"
        succ_disc = act.get("discipline") or "General"
        succ_start = str(act.get("planned_start") or "-")
        succ_finish = str(act.get("planned_finish") or "-")
        succ_duration = str(act.get("duration") or "-")

        # Extract predecessor string from parsed field or raw_values
        pred_raw = act.get("predecessors")
        if not pred_raw or pred_raw == "-":
            raw_vals = act.get("raw_values", {})
            for k, v in raw_vals.items():
                if "predecessor" in k.lower() or "depend" in k.lower():
                    if v and str(v).strip() not in ("-", "None", "nan", "null", ""):
                        pred_raw = str(v).strip()
                        break

        if not pred_raw or str(pred_raw).strip() in ("-", "None", "nan", "null", ""):
            continue

        # Split multiple comma or semicolon separated predecessors
        tokens = [t.strip() for t in re.split(r'[,;]+', str(pred_raw)) if t.strip()]

        for token in tokens:
            parsed = parse_dependency_token(token)
            pred_id = parsed["predecessor_id"]
            norm_pred_id = normalize_id(pred_id)
            dep_type = parsed["dependency_type"]

            # Validate predecessor exists in baseline schedule
            if norm_pred_id in sched_by_id:
                pred_act = sched_by_id[norm_pred_id]
                pred_name = pred_act.get("activity_name") or "Unnamed Activity"
                pred_level = pred_act.get("level") or "L6"
                pred_wbs = pred_act.get("wbs") or "-"
                pred_disc = pred_act.get("discipline") or "General"
                pred_start = str(pred_act.get("planned_start") or "-")
                pred_finish = str(pred_act.get("planned_finish") or "-")
                pred_duration = str(pred_act.get("duration") or "-")

                if norm_pred_id == norm_succ_id:
                    validation_status = "INVALID_CIRCULAR"
                    validation_reason = f"Activity '{succ_id}' cannot depend on itself."
                    invalid_count += 1
                else:
                    validation_status = "VALID"
                    validation_reason = "Predecessor and successor verified in baseline schedule."
                    valid_count += 1
            else:
                pred_act = None
                pred_name = "Unknown Predecessor"
                pred_level = "UNKNOWN"
                pred_wbs = "-"
                pred_disc = "-"
                pred_start = "-"
                pred_finish = "-"
                pred_duration = "-"
                validation_status = "INVALID_PREDECESSOR"
                validation_reason = f"Predecessor activity '{pred_id}' not found in baseline schedule."
                invalid_count += 1

            record = {
                "index": len(dependencies) + 1,
                # Top-level fields
                "predecessor_activity_id": pred_id,
                "predecessor_activity_name": pred_name,
                "predecessor_level": pred_level,
                "successor_activity_id": succ_id,
                "successor_activity_name": succ_name,
                "successor_level": succ_level,
                "dependency_type": dep_type,
                "validation_status": validation_status,
                "validation_reason": validation_reason,
                # Detailed inspection groups
                "predecessor": {
                    "activity_id": pred_id,
                    "activity_name": pred_name,
                    "level": pred_level,
                    "wbs": pred_wbs,
                    "discipline": pred_disc,
                    "planned_start": pred_start,
                    "planned_finish": pred_finish,
                    "duration": pred_duration
                },
                "successor": {
                    "activity_id": succ_id,
                    "activity_name": succ_name,
                    "level": succ_level,
                    "wbs": succ_wbs,
                    "discipline": succ_disc,
                    "planned_start": succ_start,
                    "planned_finish": succ_finish,
                    "duration": succ_duration
                },
                "relationship": {
                    "dependency_type": dep_type,
                    "flow": f"{pred_id} → {succ_id}",
                    "validation_status": validation_status,
                    "validation_reason": validation_reason
                }
            }
            dependencies.append(record)

    return {
        "schedule_file": schedule_filename,
        "total_activities": len(schedule_activities),
        "total_dependencies": len(dependencies),
        "valid_dependencies": valid_count,
        "invalid_dependencies": invalid_count,
        "dependencies": dependencies
    }
