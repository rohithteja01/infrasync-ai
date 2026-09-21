import re
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id
from app.services.schedule_linking import get_schedule_linking_results
from app.services.critical_path import calculate_critical_path


def parse_date_safely(val: Any) -> Optional[date]:
    """Parses various date representations into a standard date object."""
    if not val or val in ("-", "None", "nan", "null", ""):
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    val_str = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None


def determine_delay_status(
    planned_qty: Optional[float],
    actual_qty: Optional[float],
    progress_pct: Optional[float],
    execution_status: str = ""
) -> str:
    """
    Feature 2.17: Deterministic delay status classification based strictly on available evidence.
    - INSUFFICIENT_DATA: Missing or non-positive planned quantity.
    - NOT_STARTED: No meaningful actual progress (actual_qty == 0).
    - COMPLETED: Execution status indicates completed and progress >= 100%.
    - AHEAD: Actual quantity exceeds planned quantity (progress > 100%).
    - BEHIND: Actual progress is below planned expectations (progress < 100%).
    - ON_PLAN: Actual progress meets planned baseline expectations (progress == 100%).
    """
    if planned_qty is None or planned_qty <= 0:
        return "INSUFFICIENT_DATA"

    if actual_qty is None or actual_qty == 0 or (progress_pct is not None and progress_pct == 0.0):
        return "NOT_STARTED"

    norm_status = (execution_status or "").strip().lower()
    is_completed_tag = norm_status in ("completed", "complete", "done")

    if progress_pct is not None:
        if is_completed_tag and progress_pct >= 100.0:
            return "COMPLETED"
        if progress_pct > 100.0:
            return "AHEAD"
        if progress_pct < 100.0:
            return "BEHIND"
        # Exactly 100%
        if is_completed_tag:
            return "COMPLETED"
        return "ON_PLAN"

    # Fallback to direct quantity comparison if progress_pct was not computed
    if actual_qty == planned_qty:
        return "COMPLETED" if is_completed_tag else "ON_PLAN"
    elif actual_qty < planned_qty:
        return "BEHIND"
    else:
        return "AHEAD"


def determine_delay_severity(
    status: str,
    progress_pct: Optional[float],
    finish_variance_days: Optional[int] = None
) -> str:
    """
    Feature 2.17: Deterministic severity classification based strictly on detected variance.
    Supported classes: NO_DELAY, MINOR, MODERATE, SEVERE.

    Deterministic Thresholds:
    1. For ON_PLAN, AHEAD, COMPLETED, or INSUFFICIENT_DATA:
       -> NO_DELAY

    2. If finish_variance_days is available:
       -> finish_variance <= 0: NO_DELAY
       -> 1 <= finish_variance <= 3 days: MINOR (slight schedule deviation)
       -> 4 <= finish_variance <= 7 days: MODERATE (notable schedule deviation)
       -> finish_variance > 7 days: SEVERE (critical schedule delay)

    3. When finish_variance_days is unavailable, progress percentage deficit is evaluated:
       Deficit = 100.0 - progress_pct
       -> Deficit <= 0% (progress >= 100%): NO_DELAY
       -> 0% < Deficit <= 10% (progress 90.0% to 99.9%): MINOR
       -> 10% < Deficit <= 30% (progress 70.0% to 89.9%): MODERATE
       -> Deficit > 30% (progress < 70.0%): SEVERE
    """
    if status in ("ON_PLAN", "AHEAD", "COMPLETED", "INSUFFICIENT_DATA"):
        return "NO_DELAY"

    if status == "NOT_STARTED":
        return "MINOR"

    # For BEHIND status:
    if finish_variance_days is not None:
        if finish_variance_days <= 0:
            return "NO_DELAY"
        elif finish_variance_days <= 3:
            return "MINOR"
        elif finish_variance_days <= 7:
            return "MODERATE"
        else:
            return "SEVERE"

    # Percentage deficit evaluation
    if progress_pct is not None:
        deficit = 100.0 - progress_pct
        if deficit <= 0.0:
            return "NO_DELAY"
        elif deficit <= 10.0:
            return "MINOR"
        elif deficit <= 30.0:
            return "MODERATE"
        else:
            return "SEVERE"

    return "MODERATE"


def get_delay_detection_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.17: Delay Detection / Progress Variance Service.
    Consumes upstream Schedule Linking (Feature 2.14) and Critical Path Analysis (Feature 2.16).
    Performs baseline-vs-actual variance comparison on linked execution activities.
    Determines delay status, severity, and critical path context deterministically.
    Strictly read-only and analytical (zero database mutations or schedule changes).
    """
    # 1. Retrieve Schedule Linking results (Feature 2.14)
    linking_res = get_schedule_linking_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    linked_items = linking_res.get("results", [])

    # If strict AUTO_ACCEPT linking produced 0 items, evaluate execution_activities directly
    if not linked_items and execution_activities:
        for ea in execution_activities:
            eid = ea.get("activity_id") or ""
            ename = ea.get("activity_name") or ""
            disc = ea.get("discipline") or "General"
            try:
                p_qty = float(ea.get("planned_quantity") or 0.0)
            except (ValueError, TypeError):
                p_qty = 0.0
            try:
                a_qty = float(ea.get("actual_quantity") or 0.0)
            except (ValueError, TypeError):
                a_qty = 0.0
            p_pct = ea.get("progress") if ea.get("progress") is not None else ea.get("progress_percent")
            try:
                p_pct = float(p_pct) if p_pct is not None else None
            except (ValueError, TypeError):
                p_pct = None
            if p_pct is None and p_qty > 0:
                p_pct = round((a_qty / p_qty) * 100.0, 2)

            st = ea.get("status") or ("Completed" if (p_pct is not None and p_pct >= 100) else ("Not Started" if (p_pct == 0 or a_qty == 0) else "In Progress"))
            linked_items.append({
                "execution_activity_id": eid,
                "execution_activity_name": ename,
                "schedule_activity_id": eid,
                "schedule_activity_name": ename,
                "schedule_level": "L6",
                "discipline": disc,
                "unit": ea.get("unit") or "-",
                "execution_status": st,
                "planned_quantity": p_qty,
                "actual_quantity": a_qty,
                "quantity_variance": round(a_qty - p_qty, 2),
                "progress_percentage": p_pct,
                "planned_start": ea.get("start_date") or "-",
                "planned_finish": ea.get("end_date") or "-"
            })

    # 2. Retrieve Critical Path Method results (Feature 2.16)
    cpm_res = calculate_critical_path(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    cpm_activities = cpm_res.get("activities", [])
    cpm_by_id: Dict[str, Dict[str, Any]] = {}
    for ca in cpm_activities:
        norm_cid = normalize_id(ca.get("activity_id"))
        if norm_cid:
            cpm_by_id[norm_cid] = ca

    # 3. Index raw execution activities for actual date resolution
    exec_by_id: Dict[str, Dict[str, Any]] = {}
    for ea in execution_activities:
        norm_eid = normalize_id(ea.get("activity_id"))
        if norm_eid:
            exec_by_id[norm_eid] = ea

    evaluated_activities: List[Dict[str, Any]] = []
    behind_count = 0
    on_plan_count = 0
    ahead_count = 0
    not_started_count = 0
    completed_count = 0
    insufficient_data_count = 0
    critical_behind_count = 0
    non_critical_behind_count = 0
    total_progress_sum = 0.0

    for idx, link in enumerate(linked_items, 1):
        exec_id = link.get("execution_activity_id") or ""
        exec_name = link.get("execution_activity_name") or ""
        sched_id = link.get("schedule_activity_id") or ""
        sched_name = link.get("schedule_activity_name") or ""
        level = link.get("schedule_level") or "L6"
        discipline = link.get("discipline") or "General"
        unit = link.get("unit") or "-"
        exec_status = link.get("execution_status") or "-"

        planned_qty = link.get("planned_quantity")
        actual_qty = link.get("actual_quantity")
        qty_variance = link.get("quantity_variance")
        progress_pct = link.get("progress_percentage")

        # Baseline planned dates
        planned_start = link.get("planned_start") if link.get("planned_start") != "-" else None
        planned_finish = link.get("planned_finish") if link.get("planned_finish") != "-" else None

        # Actual dates from execution data (strictly without inventing dates)
        exec_raw = exec_by_id.get(normalize_id(exec_id), {})
        actual_start_val = exec_raw.get("start_date") or exec_raw.get("actual_start")
        actual_finish_val = exec_raw.get("end_date") or exec_raw.get("actual_finish")

        # Fallback to unmapped attributes if explicitly named
        unmapped = exec_raw.get("unmapped_attributes", {})
        if not actual_start_val:
            for k in ("Actual Start", "actual_start", "Start Date", "start_date"):
                if unmapped.get(k):
                    actual_start_val = unmapped.get(k)
                    break
        if not actual_finish_val:
            for k in ("Actual Finish", "actual_finish", "End Date", "end_date", "Finish Date"):
                if unmapped.get(k):
                    actual_finish_val = unmapped.get(k)
                    break

        actual_start_dt = parse_date_safely(actual_start_val)
        actual_finish_dt = parse_date_safely(actual_finish_val)
        planned_start_dt = parse_date_safely(planned_start)
        planned_finish_dt = parse_date_safely(planned_finish)

        # Calculate date variances if genuine actual dates exist
        if actual_start_dt and planned_start_dt:
            start_variance_days = (actual_start_dt - planned_start_dt).days
        else:
            start_variance_days = None

        if actual_finish_dt and planned_finish_dt:
            finish_variance_days = (actual_finish_dt - planned_finish_dt).days
        else:
            finish_variance_days = None

        # Look up Critical Path context from Feature 2.16
        cpm_match = cpm_by_id.get(normalize_id(sched_id), {})
        is_critical = cpm_match.get("is_critical", False)
        total_float = cpm_match.get("total_float", 0) if cpm_match else 0

        # Determine delay status
        status = determine_delay_status(
            planned_qty=planned_qty,
            actual_qty=actual_qty,
            progress_pct=progress_pct,
            execution_status=exec_status
        )

        # Determine delay severity
        severity = determine_delay_severity(
            status=status,
            progress_pct=progress_pct,
            finish_variance_days=finish_variance_days
        )

        # Tally counts
        if status == "BEHIND":
            behind_count += 1
            if is_critical:
                critical_behind_count += 1
            else:
                non_critical_behind_count += 1
        elif status == "ON_PLAN":
            on_plan_count += 1
        elif status == "AHEAD":
            ahead_count += 1
        elif status == "COMPLETED":
            completed_count += 1
        elif status == "NOT_STARTED":
            not_started_count += 1
        elif status == "INSUFFICIENT_DATA":
            insufficient_data_count += 1

        if progress_pct is not None:
            total_progress_sum += progress_pct

        # Evidence / explanation synthesis
        crit_label = "Critical (0 days float)" if is_critical else f"Non-Critical ({total_float}d float)"
        if status == "BEHIND":
            deficit_pct = round(100.0 - (progress_pct or 0.0), 2)
            evidence = (
                f"Actual progress is {progress_pct}% ({actual_qty:,.0f}/{planned_qty:,.0f} {unit}, "
                f"variance of {qty_variance:,.0f} {unit}). Deficit of {deficit_pct}% classifies delay as {severity}. "
                f"Activity is on {crit_label} path."
            )
        elif status == "COMPLETED":
            evidence = (
                f"Activity completed with {actual_qty:,.0f}/{planned_qty:,.0f} {unit} ({progress_pct}%). "
                f"Execution status '{exec_status}'. Network context: {crit_label}."
            )
        elif status == "ON_PLAN":
            evidence = (
                f"Actual progress {progress_pct}% is consistent with baseline ({actual_qty:,.0f}/{planned_qty:,.0f} {unit}). "
                f"No delay detected. Network context: {crit_label}."
            )
        elif status == "AHEAD":
            evidence = (
                f"Actual quantity {actual_qty:,.0f} {unit} exceeds planned baseline {planned_qty:,.0f} {unit} "
                f"({progress_pct}%). Activity is ahead of schedule."
            )
        elif status == "NOT_STARTED":
            evidence = f"No actual quantity recorded (0 {unit} out of {planned_qty:,.0f} {unit}). Activity has not started."
        else:
            evidence = "Planned baseline quantity or progress information is unavailable for comparison."

        record = {
            "index": idx,
            "activity_id": sched_id or exec_id,
            "activity_name": sched_name or exec_name,
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "schedule_activity_id": sched_id,
            "schedule_activity_name": sched_name,
            "level": level,
            "discipline": discipline,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "progress_percent": progress_pct,
            "quantity_variance": qty_variance,
            "planned_start": planned_start,
            "planned_finish": planned_finish,
            "actual_start": actual_start_dt.isoformat() if actual_start_dt else None,
            "actual_finish": actual_finish_dt.isoformat() if actual_finish_dt else None,
            "start_variance_days": start_variance_days,
            "finish_variance_days": finish_variance_days,
            "total_float": total_float,
            "critical": is_critical,
            "is_critical": is_critical,
            "critical_status": "CRITICAL" if is_critical else "NON_CRITICAL",
            "status": status,
            "severity": severity,
            "evidence": evidence,
            "reason": evidence
        }
        evaluated_activities.append(record)

    total_evaluated = len(evaluated_activities)
    avg_progress = round(total_progress_sum / total_evaluated, 2) if total_evaluated > 0 else 0.0

    # Temporal context check across execution and baseline
    has_date_mismatch = False
    date_mismatch_warning = None
    diffs = [
        abs(a["start_variance_days"])
        for a in evaluated_activities
        if a.get("start_variance_days") is not None
    ]
    if diffs and max(diffs) > 180:
        has_date_mismatch = True
        date_mismatch_warning = (
            "Temporal Context Notice: Execution progress dates belong to a different period/year than the loaded baseline schedule. "
            "Calculations preserve exact source dates without synthetic modification. Ensure the corresponding baseline schedule is selected for baseline calendar comparison."
        )

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "total_linked": len(linked_items),
        "total_evaluated": total_evaluated,
        "behind_count": behind_count,
        "on_plan_count": on_plan_count,
        "ahead_count": ahead_count,
        "not_started_count": not_started_count,
        "completed_count": completed_count,
        "insufficient_data_count": insufficient_data_count,
        "critical_behind_count": critical_behind_count,
        "non_critical_behind_count": non_critical_behind_count,
        "average_progress_percent": avg_progress,
        "date_context_warning": date_mismatch_warning,
        "temporal_mismatch": has_date_mismatch,
        "activities": evaluated_activities
    }
