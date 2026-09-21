from typing import Dict, Any, List, Optional
from app.services.matching import calculate_validation_results, normalize_id


def calculate_variance_and_progress(planned_qty: float, actual_qty: float) -> Dict[str, Any]:
    """
    Feature 2.14: Computes quantity variance, progress percentage, and variance status.
    - quantity_variance = actual_quantity - planned_quantity
    - progress_percentage = (actual_quantity / planned_quantity) * 100
    - variance_status:
        actual == planned -> ON_PLAN
        actual < planned  -> BEHIND
        actual > planned  -> AHEAD
    """
    qty_variance = round(actual_qty - planned_qty, 4)

    if planned_qty > 0:
        progress_pct = round((actual_qty / planned_qty) * 100.0, 2)
    else:
        progress_pct = None

    if actual_qty == planned_qty:
        status = "ON_PLAN"
    elif actual_qty < planned_qty:
        status = "BEHIND"
    else:
        status = "AHEAD"

    return {
        "quantity_variance": qty_variance,
        "progress_percentage": progress_pct,
        "variance_status": status
    }


def get_schedule_linking_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.14 Part 1: Schedule Linking (Planning-to-Execution Bridge).
    Consumes Feature 2.12 validation results without duplicating matching logic.
    Filters strictly for records with validation_status == 'AUTO_ACCEPT'.
    Planner Review records (e.g. SEM-L6-01, UNM-99-99) are excluded from linking.
    Calculates execution quantity variance, progress percentage, and variance status.
    Does NOT modify schedule files, write to database, or perform updates.
    """
    # 1. Ingest upstream validation results directly
    validation_output = calculate_validation_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename,
        auto_accept_threshold=0.90
    )

    # 2. Build index of execution activities
    exec_by_id: Dict[str, Dict[str, Any]] = {}
    for e in execution_activities:
        eid = normalize_id(e.get("activity_id"))
        if eid:
            exec_by_id[eid] = e

    # 3. Build index of schedule activities
    sched_by_id: Dict[str, Dict[str, Any]] = {}
    for s in schedule_activities:
        sid = normalize_id(s.get("activity_id"))
        if sid:
            sched_by_id[sid] = s

    all_val_results = validation_output.get("results", [])
    linked_records: List[Dict[str, Any]] = []
    excluded_count = 0
    on_plan_count = 0
    behind_count = 0
    ahead_count = 0

    for item in all_val_results:
        # Strictly respect governance boundary: only AUTO_ACCEPT is linked
        if item.get("validation_status") != "AUTO_ACCEPT":
            excluded_count += 1
            continue

        exec_id = item.get("execution_activity_id")
        norm_exec_id = normalize_id(exec_id)
        exec_data = exec_by_id.get(norm_exec_id, {})

        sched_id = item.get("matched_schedule_activity_id")
        norm_sched_id = normalize_id(sched_id)
        sched_data = sched_by_id.get(norm_sched_id, {})

        # Execution fields
        exec_name = exec_data.get("activity_name") or item.get("execution_activity_name") or ""
        exec_disc = exec_data.get("discipline") or item.get("discipline") or "General"
        unmapped = exec_data.get("unmapped_attributes", {})
        exec_wbs = exec_data.get("wbs") or unmapped.get("WBS") or item.get("execution_wbs") or "-"
        try:
            planned_qty = float(exec_data.get("planned_quantity") or 0.0)
        except (ValueError, TypeError):
            planned_qty = 0.0

        try:
            actual_qty = float(exec_data.get("actual_quantity") or 0.0)
        except (ValueError, TypeError):
            actual_qty = 0.0

        unit = exec_data.get("unit") or "-"
        exec_status = exec_data.get("status") or "-"

        # Baseline schedule fields
        sched_name = sched_data.get("activity_name") or item.get("matched_schedule_activity_name") or ""
        sched_wbs = sched_data.get("wbs") or "-"
        sched_level = sched_data.get("level") or item.get("granularity_status") or "L6"
        planned_start = str(sched_data.get("planned_start") or "-")
        planned_finish = str(sched_data.get("planned_finish") or "-")
        duration = str(sched_data.get("duration") or "-")
        sched_disc = sched_data.get("discipline") or exec_disc

        # Link validation fields
        candidate_tier = item.get("candidate_tier") or "EXACT"
        confidence_score = float(item.get("confidence_score") if item.get("confidence_score") is not None else 1.0)
        confidence_pct = int(item.get("confidence_percentage", 100))
        val_status = item.get("validation_status") or "AUTO_ACCEPT"
        granularity = item.get("granularity_status") or sched_level

        # Progress comparison & variance
        variance_info = calculate_variance_and_progress(planned_qty=planned_qty, actual_qty=actual_qty)
        qty_variance = variance_info["quantity_variance"]
        progress_pct = variance_info["progress_percentage"]
        var_status = variance_info["variance_status"]

        if var_status == "ON_PLAN":
            on_plan_count += 1
        elif var_status == "BEHIND":
            behind_count += 1
        elif var_status == "AHEAD":
            ahead_count += 1

        record = {
            "index": len(linked_records) + 1,
            # Top-level fields
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "discipline": exec_disc,
            "execution_wbs": exec_wbs,
            "unit": unit,
            "execution_status": exec_status,
            "schedule_activity_id": sched_id,
            "schedule_activity_name": sched_name,
            "schedule_wbs": sched_wbs,
            "schedule_level": sched_level,
            "planned_start": planned_start,
            "planned_finish": planned_finish,
            "duration": duration,
            "schedule_discipline": sched_disc,
            "candidate_tier": candidate_tier,
            "confidence_score": confidence_score,
            "confidence_percentage": confidence_pct,
            "validation_status": val_status,
            "granularity_status": granularity,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "quantity_variance": qty_variance,
            "progress_percentage": progress_pct,
            "variance_status": var_status,
            # Structured detail groups
            "execution": {
                "activity_id": exec_id,
                "activity_name": exec_name,
                "discipline": exec_disc,
                "wbs": exec_wbs,
                "planned_quantity": planned_qty,
                "actual_quantity": actual_qty,
                "unit": unit,
                "status": exec_status
            },
            "schedule": {
                "schedule_activity_id": sched_id,
                "schedule_activity_name": sched_name,
                "wbs": sched_wbs,
                "level": sched_level,
                "planned_start": planned_start,
                "planned_finish": planned_finish,
                "duration": duration,
                "discipline": sched_disc
            },
            "validation": {
                "candidate_tier": candidate_tier,
                "confidence_score": confidence_score,
                "confidence_percentage": confidence_pct,
                "validation_status": val_status,
                "granularity_status": granularity
            },
            "comparison": {
                "planned_quantity": planned_qty,
                "actual_quantity": actual_qty,
                "quantity_variance": qty_variance,
                "progress_percentage": progress_pct,
                "variance_status": var_status
            }
        }
        linked_records.append(record)

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_linked": len(linked_records),
        "on_plan_count": on_plan_count,
        "behind_count": behind_count,
        "ahead_count": ahead_count,
        "total_excluded": excluded_count,
        "results": linked_records
    }
