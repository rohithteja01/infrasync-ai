import re
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id
from app.services.critical_path import calculate_critical_path, parse_iso_date
from app.services.delay_detection import get_delay_detection_results


def calculate_deterministic_health_score(
    total_evaluated: int,
    behind_count: int,
    critical_behind_count: int,
    total_milestones: int,
    at_risk_milestones: int
) -> Dict[str, Any]:
    """
    Feature 2.18: Deterministic overall schedule health scoring (0-100 scale).

    Mathematical Formulation:
    Base Score: 100 points
    Deductions:
    1. Overall Activity Delay Impact (up to 35 points):
       delay_ratio = behind_count / total_evaluated
       penalty_delay = delay_ratio * 35.0

    2. Critical Path Delay Impact (up to 40 points):
       critical_delay_ratio = critical_behind_count / total_evaluated
       penalty_critical = critical_delay_ratio * 40.0

    3. Milestone Risk Impact (up to 25 points):
       milestone_risk_ratio = at_risk_milestones / total_milestones
       penalty_milestone = milestone_risk_ratio * 25.0

    Total Deductions = penalty_delay + penalty_critical + penalty_milestone
    Final Score = max(0.0, round(100.0 - Total Deductions, 1))

    Classification Thresholds:
    - Score >= 80.0: HEALTHY (Low delay, zero critical-path impact, milestones on track)
    - 60.0 <= Score < 80.0: WATCH (Moderate delay, limited critical risk)
    - Score < 60.0: AT_RISK (High delay ratio, critical-path impact, or milestone risk)
    - Insufficient data if total_evaluated == 0: INSUFFICIENT_DATA
    """
    if total_evaluated == 0 or total_milestones == 0:
        return {
            "status": "INSUFFICIENT_DATA",
            "score": None,
            "reason": "Insufficient execution or milestone data to evaluate schedule health."
        }

    delay_ratio = behind_count / total_evaluated
    critical_ratio = critical_behind_count / total_evaluated
    milestone_ratio = at_risk_milestones / total_milestones

    penalty_delay = delay_ratio * 35.0
    penalty_critical = critical_ratio * 40.0
    penalty_milestone = milestone_ratio * 25.0

    total_deductions = penalty_delay + penalty_critical + penalty_milestone
    score = max(0.0, min(100.0, round(100.0 - total_deductions, 1)))

    if score >= 80.0:
        status = "HEALTHY"
        reason = (
            f"Schedule is HEALTHY (score: {score}/100). Low delay ratio ({behind_count}/{total_evaluated}), "
            f"zero critical path delays, and milestones remain on track."
        )
    elif score >= 60.0:
        status = "WATCH"
        reason = (
            f"Schedule is on WATCH (score: {score}/100). Moderate delays detected ({behind_count}/{total_evaluated}), "
            f"but critical-path and milestone risk remains contained."
        )
    else:
        status = "AT_RISK"
        reason = (
            f"Schedule is AT_RISK (score: {score}/100). {behind_count} of {total_evaluated} evaluated activities "
            f"are behind schedule ({round(delay_ratio * 100, 1)}%), with {critical_behind_count} driving "
            f"the Critical Path, placing milestone delivery at risk."
        )

    return {
        "status": status,
        "score": score,
        "reason": reason,
        "metrics": {
            "delay_ratio": round(delay_ratio, 3),
            "critical_delay_ratio": round(critical_ratio, 3),
            "milestone_risk_ratio": round(milestone_ratio, 3),
            "penalties": {
                "activity_delay": round(penalty_delay, 1),
                "critical_delay": round(penalty_critical, 1),
                "milestone_risk": round(penalty_milestone, 1)
            }
        }
    }


def get_schedule_health_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.18: Milestone & Schedule Health Service.
    - Derives milestone candidates deterministically from L5 parent activities.
    - Maps supporting L6 activities via existing WBS hierarchy.
    - Evaluates milestone progress, schedule variance, and deterministic projections.
    - Assesses overall schedule health and health score deterministically.
    - Strictly read-only and analytical (zero database mutations).
    """
    # 1. Retrieve Critical Path Analysis (Feature 2.16)
    cpm_res = calculate_critical_path(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    cpm_acts = {normalize_id(a.get("activity_id")): a for a in cpm_res.get("activities", [])}

    # 2. Retrieve Delay Detection results (Feature 2.17)
    delay_res = get_delay_detection_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    delay_by_sched_id: Dict[str, Dict[str, Any]] = {}
    for da in delay_res.get("activities", []):
        sid = normalize_id(da.get("schedule_activity_id"))
        if sid:
            delay_by_sched_id[sid] = da

    # 3. Separate L5 milestone candidates and L6 supporting activities
    l5_activities = [a for a in schedule_activities if (a.get("level") or "").upper() in ("L5", "LEVEL 5", "5")]
    l6_activities = [a for a in schedule_activities if (a.get("level") or "").upper() in ("L6", "LEVEL 6", "6")]

    milestones_list: List[Dict[str, Any]] = []
    completed_milestones = 0
    on_track_milestones = 0
    behind_milestones = 0
    not_started_milestones = 0
    insufficient_milestones = 0
    at_risk_milestones = 0
    forecast_available_count = 0

    for idx, l5 in enumerate(l5_activities, 1):
        l5_id = l5.get("activity_id") or f"L5-{idx:02d}"
        norm_l5_id = normalize_id(l5_id)
        l5_name = l5.get("activity_name") or "Unnamed Milestone"
        l5_wbs = str(l5.get("wbs") or "").strip()
        l5_disc = l5.get("discipline") or "General"
        p_start_str = l5.get("planned_start")
        p_finish_str = l5.get("planned_finish")

        p_start_dt = parse_iso_date(p_start_str)
        p_finish_dt = parse_iso_date(p_finish_str)

        # Baseline duration
        if p_start_dt and p_finish_dt and p_finish_dt >= p_start_dt:
            baseline_dur_days = (p_finish_dt - p_start_dt).days
        else:
            baseline_dur_days = 0

        # Critical path context for L5 activity itself
        l5_cpm = cpm_acts.get(norm_l5_id, {})
        l5_is_critical = l5_cpm.get("is_critical", False)
        l5_float = l5_cpm.get("total_float", 0)

        # 4. Identify supporting L6 activities via WBS hierarchy (e.g. 1.1.2.1 -> 1.1.2.1.1, 1.1.2.1.2)
        supporting_l6: List[Dict[str, Any]] = []
        if l5_wbs and l5_wbs != "-":
            wbs_prefix = l5_wbs if l5_wbs.endswith(".") else f"{l5_wbs}."
            supporting_l6 = [
                a for a in l6_activities
                if str(a.get("wbs") or "").strip().startswith(wbs_prefix)
            ]

        supp_count = len(supporting_l6)
        crit_supp_count = 0
        delayed_supp_count = 0
        supp_progresses: List[float] = []
        supp_records: List[Dict[str, Any]] = []

        for s in supporting_l6:
            s_id = s.get("activity_id") or ""
            norm_sid = normalize_id(s_id)
            s_name = s.get("activity_name") or ""
            s_cpm = cpm_acts.get(norm_sid, {})
            s_is_critical = s_cpm.get("is_critical", False)
            if s_is_critical:
                crit_supp_count += 1

            s_delay = delay_by_sched_id.get(norm_sid)
            s_status = s_delay.get("status") if s_delay else "NO_DATA"
            s_prog = s_delay.get("progress_percent") if s_delay else None

            if s_status == "BEHIND":
                delayed_supp_count += 1

            if s_prog is not None:
                supp_progresses.append(s_prog)

            supp_records.append({
                "activity_id": s_id,
                "activity_name": s_name,
                "wbs": s.get("wbs") or "-",
                "is_critical": s_is_critical,
                "delay_status": s_status,
                "progress_percent": s_prog
            })

        # 5. Milestone Progress Calculation
        # Check direct execution linking first (e.g. CIV-L5-01)
        direct_delay = delay_by_sched_id.get(norm_l5_id)
        if supp_progresses:
            # Average progress of supporting execution activities
            calc_progress = round(sum(supp_progresses) / len(supp_progresses), 2)
        elif direct_delay and direct_delay.get("progress_percent") is not None:
            calc_progress = round(float(direct_delay.get("progress_percent")), 2)
        else:
            calc_progress = None

        # 6. Milestone Status & Risk Evaluation
        all_supp_completed = (supp_count > 0 and len(supp_progresses) == supp_count and all(p >= 100.0 for p in supp_progresses))
        
        if supp_count > 0 and delayed_supp_count > 0 and (delayed_supp_count / supp_count) >= 0.5:
            status = "BEHIND"
            risk_level = "HIGH" if crit_supp_count > 0 else "MEDIUM"
            at_risk = True
        elif all_supp_completed:
            status = "COMPLETED"
            risk_level = "LOW"
            at_risk = False
        elif (supp_progresses and any(p > 0.0 for p in supp_progresses)) or (calc_progress is not None and calc_progress > 0.0):
            status = "ON_TRACK"
            risk_level = "LOW"
            at_risk = False
        elif p_start_dt and date.today() < p_start_dt:
            status = "NOT_STARTED"
            risk_level = "MEDIUM" if l5_is_critical else "LOW"
            at_risk = False
        else:
            status = "NOT_STARTED"
            risk_level = "LOW"
            at_risk = False

        # Tally counts
        if status == "BEHIND":
            behind_milestones += 1
        elif status == "ON_TRACK":
            on_track_milestones += 1
        elif status == "COMPLETED":
            completed_milestones += 1
        elif status == "NOT_STARTED":
            not_started_milestones += 1
        else:
            insufficient_milestones += 1

        if at_risk:
            at_risk_milestones += 1

        # 7. Deterministic Forecasting (DETERMINISTIC_PROGRESS_PROJECTION)
        # Only project when meaningful in-progress execution data exists
        forecast_finish_str: Optional[str] = None
        forecast_variance_days: Optional[int] = None
        forecast_status: str = "INSUFFICIENT_DATA"

        if status == "COMPLETED":
            forecast_finish_str = p_finish_str
            forecast_variance_days = 0
            forecast_status = "COMPLETED"
        elif calc_progress is not None and 0.0 < calc_progress < 100.0 and baseline_dur_days > 0 and p_start_dt:
            # Deterministic projection: required_days = baseline_dur / (progress / 100)
            proj_duration = round(baseline_dur_days / (calc_progress / 100.0))
            proj_finish_dt = p_start_dt + timedelta(days=proj_duration)
            forecast_finish_str = proj_finish_dt.isoformat()
            if p_finish_dt:
                forecast_variance_days = (proj_finish_dt - p_finish_dt).days
            forecast_status = "PROJECTED"
            forecast_available_count += 1

        # 8. Analytical Reason Synthesis
        crit_context = "Critical Path package (0d float)" if l5_is_critical else f"Non-Critical ({l5_float}d float)"
        if status == "BEHIND":
            reason = (
                f"{delayed_supp_count} of {supp_count} supporting activities are delayed under WBS {l5_wbs}. "
                f"Average supporting progress is {calc_progress}%. Deterministic projection estimates completion "
                f"at {forecast_finish_str} ({'+' if forecast_variance_days and forecast_variance_days > 0 else ''}"
                f"{forecast_variance_days}d variance). Context: {crit_context}."
            )
        elif status == "COMPLETED":
            reason = f"Milestone is 100% completed. Supporting activities completed on plan. Context: {crit_context}."
        elif status == "ON_TRACK":
            reason = f"Supporting execution activities are progressing on track ({calc_progress}% progress). Context: {crit_context}."
        elif status == "NOT_STARTED":
            reason = f"Package scheduled to commence on {p_start_str}. No site execution progress recorded yet. Context: {crit_context}."
        else:
            reason = "Insufficient baseline or execution progress data to evaluate milestone condition."

        milestone_record = {
            "index": idx,
            "milestone_id": f"MS-{idx:02d}",
            "milestone_name": l5_name,
            "derivation_type": "DERIVED_L5_MILESTONE",
            "source_activity_id": l5_id,
            "source_level": "L5",
            "discipline": l5_disc,
            "wbs": l5_wbs,
            "planned_start": p_start_str,
            "planned_finish": p_finish_str,
            "actual_start": None,  # Preserved: strictly no manufactured dates
            "actual_finish": None,  # Preserved: strictly no manufactured dates
            "progress_percent": calc_progress,
            "schedule_variance_days": None,  # Actual finish does not exist yet
            "status": status,
            "forecast_finish": forecast_finish_str,
            "forecast_variance_days": forecast_variance_days,
            "forecast_status": forecast_status,
            "forecast_method": "DETERMINISTIC_PROGRESS_PROJECTION",
            "risk_level": risk_level,
            "critical_risk": l5_is_critical or (crit_supp_count > 0),
            "supporting_activity_count": supp_count,
            "delayed_supporting_activity_count": delayed_supp_count,
            "critical_supporting_activity_count": crit_supp_count,
            "supporting_activities": supp_records,
            "reason": reason
        }
        milestones_list.append(milestone_record)

    # 9. Compute Overall Schedule Health
    total_evaluated_acts = delay_res.get("total_evaluated", 0)
    behind_acts = delay_res.get("behind_count", 0)
    crit_behind_acts = delay_res.get("critical_behind_count", 0)

    health_assessment = calculate_deterministic_health_score(
        total_evaluated=total_evaluated_acts,
        behind_count=behind_acts,
        critical_behind_count=crit_behind_acts,
        total_milestones=len(milestones_list),
        at_risk_milestones=at_risk_milestones
    )

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "schedule_health": health_assessment,
        "milestones": milestones_list,
        "summary": {
            "total_milestones": len(milestones_list),
            "completed": completed_milestones,
            "on_track": on_track_milestones,
            "behind": behind_milestones,
            "not_started": not_started_milestones,
            "insufficient_data": insufficient_milestones,
            "at_risk": at_risk_milestones,
            "forecast_available": forecast_available_count
        }
    }
