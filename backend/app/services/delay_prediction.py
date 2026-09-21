import re
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id
from app.services.delay_detection import get_delay_detection_results
from app.services.schedule_health import get_schedule_health_results


def calculate_deterministic_prediction_score(
    progress_percent: Optional[float],
    current_delay_status: str,
    current_severity: str,
    is_critical: bool,
    total_float: Optional[int],
    milestone_risk_level: Optional[str] = None,
    milestone_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Feature 2.19: Deterministic multi-factor delay prediction scoring (0-100 scale).

    Evaluates whether an active schedule activity is likely to experience future delay
    based strictly on available, verified project metrics:

    1. Progress Deficit / Velocity Risk (Weight: 35 points max):
       - If completed (progress >= 100%): 0.0 pts
       - Deficit > 50%: 35.0 pts
       - Deficit > 30%: 25.0 pts
       - Deficit > 15%: 18.0 pts
       - Deficit > 0%: 10.0 pts
       - Deficit == 0%: 0.0 pts

    2. Critical Path & Float Exposure (Weight: 30 points max):
       - If completed: 0.0 pts (completed task cannot delay critical path)
       - If is_critical (Total Float == 0): 30.0 pts
       - If not on critical path and Total Float < 5: 15.0 pts
       - If not on critical path and Total Float >= 5: 0.0 pts

    3. Current Delay Severity Level (Weight: 20 points max):
       - SEVERE: 20.0 pts
       - MODERATE: 12.0 pts
       - MINOR: 6.0 pts
       - NO_DELAY / COMPLETED: 0.0 pts

    4. Parent Milestone Context & WBS Risk (Weight: 15 points max):
       - Milestone risk HIGH: 15.0 pts
       - Milestone risk MEDIUM: 8.0 pts
       - Milestone risk LOW or None: 0.0 pts

    Scoring Categories:
    - HIGH_RISK (Score >= 70.0): predicted_delay_risk = HIGH
    - MEDIUM_RISK (40.0 <= Score < 70.0): predicted_delay_risk = MEDIUM
    - LOW_RISK (Score < 40.0): predicted_delay_risk = LOW
    - INSUFFICIENT_DATA: Missing progress or invalid status -> score = null, predicted_delay_risk = UNKNOWN
    """
    # 1. Data Sufficiency Check
    if progress_percent is None or current_delay_status == "INSUFFICIENT_DATA":
        return {
            "score": None,
            "prediction_status": "INSUFFICIENT_DATA",
            "predicted_delay_risk": "UNKNOWN",
            "data_sufficiency": "INSUFFICIENT",
            "prediction_basis": (
                "Insufficient execution metrics. Missing verified planned/actual progress data; "
                "delay risk cannot be reliably determined without progress evidence."
            ),
            "score_breakdown": {
                "deficit_points": 0.0,
                "critical_path_points": 0.0,
                "severity_points": 0.0,
                "milestone_points": 0.0
            }
        }

    # 2. Completed / Fulfilled Work
    if current_delay_status == "COMPLETED" or progress_percent >= 100.0:
        return {
            "score": 0.0,
            "prediction_status": "LOW_RISK",
            "predicted_delay_risk": "LOW",
            "data_sufficiency": "SUFFICIENT",
            "prediction_basis": (
                "Activity is 100% completed. Execution scope is fully fulfilled with zero remaining delay risk."
            ),
            "score_breakdown": {
                "deficit_points": 0.0,
                "critical_path_points": 0.0,
                "severity_points": 0.0,
                "milestone_points": 0.0
            }
        }

    # 3. Active / Ongoing Multi-Factor Scoring
    progress_val = float(progress_percent)
    progress_deficit = max(0.0, 100.0 - progress_val)

    # Dimension 1: Progress Deficit
    if progress_deficit > 50.0:
        deficit_pts = 35.0
    elif progress_deficit > 30.0:
        deficit_pts = 25.0
    elif progress_deficit > 15.0:
        deficit_pts = 18.0
    elif progress_deficit > 0.0:
        deficit_pts = 10.0
    else:
        deficit_pts = 0.0

    # Dimension 2: Critical Path Exposure
    if is_critical or (total_float is not None and total_float == 0):
        critical_pts = 30.0
    elif total_float is not None and total_float < 5:
        critical_pts = 15.0
    else:
        critical_pts = 0.0

    # Dimension 3: Current Delay Severity
    sev_upper = (current_severity or "").upper()
    if sev_upper == "SEVERE":
        severity_pts = 20.0
    elif sev_upper == "MODERATE":
        severity_pts = 12.0
    elif sev_upper == "MINOR":
        severity_pts = 6.0
    else:
        severity_pts = 0.0

    # Dimension 4: Parent Milestone Risk
    ms_risk_upper = (milestone_risk_level or "").upper()
    if ms_risk_upper == "HIGH":
        milestone_pts = 15.0
    elif ms_risk_upper == "MEDIUM":
        milestone_pts = 8.0
    else:
        milestone_pts = 0.0

    total_score = min(100.0, max(0.0, round(deficit_pts + critical_pts + severity_pts + milestone_pts, 1)))

    if total_score >= 70.0:
        prediction_status = "HIGH_RISK"
        predicted_delay_risk = "HIGH"
        risk_desc = "High delay probability"
    elif total_score >= 40.0:
        prediction_status = "MEDIUM_RISK"
        predicted_delay_risk = "MEDIUM"
        risk_desc = "Moderate delay probability"
    else:
        prediction_status = "LOW_RISK"
        predicted_delay_risk = "LOW"
        risk_desc = "Low delay probability"

    # Construct explainable basis narrative
    basis_parts = [
        f"{risk_desc} (score: {total_score}/100).",
        f"Progress deficit of {round(progress_deficit, 1)}% ({round(progress_val, 1)}% achieved, +{deficit_pts} pts)."
    ]
    if critical_pts > 0:
        basis_parts.append(f"Zero float driving the Critical Path (+{critical_pts} pts).")
    else:
        basis_parts.append(f"Non-critical schedule path (float: {total_float if total_float is not None else 'N/A'}d, +0 pts).")

    if severity_pts > 0:
        basis_parts.append(f"Current delay severity is {sev_upper} (+{severity_pts} pts).")

    if milestone_pts > 0 and milestone_id:
        basis_parts.append(f"Supporting high-risk parent milestone {milestone_id} (+{milestone_pts} pts).")

    prediction_basis = " ".join(basis_parts)

    return {
        "score": total_score,
        "prediction_status": prediction_status,
        "predicted_delay_risk": predicted_delay_risk,
        "data_sufficiency": "SUFFICIENT",
        "prediction_basis": prediction_basis,
        "score_breakdown": {
            "deficit_points": deficit_pts,
            "critical_path_points": critical_pts,
            "severity_points": severity_pts,
            "milestone_points": milestone_pts
        }
    }


def get_delay_prediction_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.19: Delay Prediction Service.
    - Consumes verified outputs from Delay Detection (Feature 2.17) and Schedule Health (Feature 2.18).
    - Evaluates each eligible linked activity across multi-factor deterministic risk dimensions.
    - Preserves Planner Review governance (excluded activities remain excluded).
    - Strictly read-only and analytical (zero database mutations).
    """
    # 1. Retrieve Delay Detection results (Feature 2.17)
    delay_res = get_delay_detection_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    # 2. Retrieve Schedule Health & Milestone context (Feature 2.18)
    health_res = get_schedule_health_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    # 3. Build lookup for parent milestone context by activity ID
    milestone_map: Dict[str, Dict[str, Any]] = {}
    for ms in health_res.get("milestones", []):
        ms_id = ms.get("milestone_id")
        ms_risk = ms.get("risk_level")
        ms_status = ms.get("status")
        # Direct source activity
        src_id = normalize_id(ms.get("source_activity_id"))
        if src_id:
            milestone_map[src_id] = {
                "milestone_id": ms_id,
                "risk_level": ms_risk,
                "status": ms_status
            }
        # Supporting L6 activities
        for supp in ms.get("supporting_activities", []):
            supp_id = normalize_id(supp.get("activity_id"))
            if supp_id:
                milestone_map[supp_id] = {
                    "milestone_id": ms_id,
                    "risk_level": ms_risk,
                    "status": ms_status
                }

    # 4. Evaluate each linked activity deterministically
    sched_by_id = {normalize_id(s.get("activity_id")): s for s in schedule_activities}
    evaluated_activities = delay_res.get("activities", [])
    predictions_list: List[Dict[str, Any]] = []

    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0
    insufficient_count = 0
    valid_scores: List[float] = []

    for act in evaluated_activities:
        eid = act.get("execution_activity_id") or ""
        sid = act.get("schedule_activity_id") or ""
        norm_sid = normalize_id(sid)

        sched_info = sched_by_id.get(norm_sid) or {}
        raw_dur = sched_info.get("duration") or sched_info.get("planned_duration") or act.get("baseline_duration") or 0
        dur_match = re.search(r'\d+', str(raw_dur))
        duration_val = int(dur_match.group()) if dur_match else 0

        # Milestone lookup
        ms_info = milestone_map.get(norm_sid) or milestone_map.get(normalize_id(eid)) or {}
        ms_id = ms_info.get("milestone_id")
        ms_risk = ms_info.get("risk_level")

        prog_pct = act.get("progress_percent")
        delay_status = act.get("status") or "INSUFFICIENT_DATA"
        severity = act.get("severity") or "NO_DELAY"
        is_critical = bool(act.get("critical", False))
        total_float = act.get("total_float")

        # Compute deterministic prediction score
        pred_res = calculate_deterministic_prediction_score(
            progress_percent=prog_pct,
            current_delay_status=delay_status,
            current_severity=severity,
            is_critical=is_critical,
            total_float=total_float,
            milestone_risk_level=ms_risk,
            milestone_id=ms_id
        )

        p_status = pred_res["prediction_status"]
        p_risk = pred_res["predicted_delay_risk"]
        p_score = pred_res["score"]

        if p_status == "HIGH_RISK":
            high_risk_count += 1
        elif p_status == "MEDIUM_RISK":
            medium_risk_count += 1
        elif p_status == "LOW_RISK":
            low_risk_count += 1
        else:
            insufficient_count += 1

        if p_score is not None:
            valid_scores.append(p_score)

        # Progress variance is difference from 100% baseline expectation
        prog_variance = round(prog_pct - 100.0, 2) if prog_pct is not None else None

        record = {
            "activity_id": eid,
            "activity_name": act.get("execution_activity_name") or "",
            "schedule_activity_id": sid,
            "schedule_level": sched_info.get("level") or act.get("schedule_level") or "L6",
            "discipline": act.get("discipline") or "General",
            "baseline_duration": duration_val,
            "progress_percent": prog_pct,
            "progress_variance": prog_variance,
            "quantity_variance": act.get("quantity_variance"),
            "current_delay_status": delay_status,
            "current_severity": severity,
            "critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
            "total_float": total_float,
            "milestone_id": ms_id,
            "prediction_status": p_status,
            "predicted_delay_risk": p_risk,
            "prediction_score": p_score,
            "prediction_basis": pred_res["prediction_basis"],
            "data_sufficiency": pred_res["data_sufficiency"],
            "score_breakdown": pred_res["score_breakdown"]
        }
        predictions_list.append(record)

    avg_score = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else None

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "summary": {
            "total_evaluated": len(predictions_list),
            "high_risk_count": high_risk_count,
            "medium_risk_count": medium_risk_count,
            "low_risk_count": low_risk_count,
            "insufficient_data_count": insufficient_count,
            "average_prediction_score": avg_score
        },
        "predictions": predictions_list
    }
