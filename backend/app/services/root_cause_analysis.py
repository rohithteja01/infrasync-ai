import re
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id
from app.services.delay_detection import get_delay_detection_results
from app.services.critical_path import calculate_critical_path
from app.services.schedule_dependencies import get_schedule_dependencies
from app.services.schedule_health import get_schedule_health_results
from app.services.delay_prediction import get_delay_prediction_results


def analyze_activity_root_cause(
    activity: Dict[str, Any],
    pred_info: Dict[str, Any],
    dependencies: List[Dict[str, Any]],
    activities_by_sched_id: Dict[str, Dict[str, Any]],
    milestone_map: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Feature 2.20: Deterministic Root Cause Analysis for a single delayed/at-risk activity.

    Evaluates whether and how:
    1. Progress Shortfall (progress_deficit > 0)
    2. Quantity Shortfall (quantity_variance < 0)
    3. Critical Path Exposure / Low Float (is_critical / float < 5)
    4. Predecessor Cascade Risk (predecessor is behind)
    5. Milestone Risk Exposure (parent milestone is high risk)

    Contribute to the activity's delay or risk.
    """
    eid = activity.get("execution_activity_id") or ""
    ename = activity.get("execution_activity_name") or ""
    sid = activity.get("schedule_activity_id") or ""
    norm_sid = normalize_id(sid)
    norm_eid = normalize_id(eid)

    level = activity.get("schedule_level") or "L6"
    discipline = activity.get("discipline") or "General"
    current_status = activity.get("status") or "INSUFFICIENT_DATA"
    severity = activity.get("severity") or "NO_DELAY"
    is_critical = bool(activity.get("critical", False))
    total_float = activity.get("total_float")

    planned_qty = activity.get("planned_quantity")
    actual_qty = activity.get("actual_quantity")
    qty_variance = activity.get("quantity_variance")
    unit = activity.get("unit") or "units"

    prog_pct = activity.get("progress_percent")
    prog_deficit = round(max(0.0, 100.0 - float(prog_pct)), 2) if prog_pct is not None else None

    # Milestone context
    ms_info = milestone_map.get(norm_sid) or milestone_map.get(norm_eid) or {}
    ms_id = ms_info.get("milestone_id")
    ms_name = ms_info.get("milestone_name") or ms_id
    ms_risk = ms_info.get("risk_level")

    # 1. Check Data Sufficiency
    if prog_pct is None or current_status == "INSUFFICIENT_DATA" or planned_qty is None:
        return {
            "activity_id": eid,
            "activity_name": ename,
            "schedule_activity_id": sid,
            "schedule_level": level,
            "discipline": discipline,
            "current_delay_status": current_status,
            "current_severity": severity,
            "progress_percent": prog_pct,
            "progress_deficit": prog_deficit,
            "quantity_variance": qty_variance,
            "critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
            "total_float": total_float,
            "milestone_id": ms_id,
            "milestone_risk": ms_risk,
            "root_cause_category": "INSUFFICIENT_EVIDENCE",
            "root_cause_confidence": None,
            "contributing_factors": [],
            "evidence": [
                "Insufficient execution or schedule metrics. Missing verified planned/actual progress data; "
                "root cause cannot be determined without physical progress evidence."
            ],
            "analysis_status": "INSUFFICIENT_DATA"
        }

    contributing_factors: List[str] = []
    evidence_list: List[str] = []

    # 2. Check Progress Shortfall
    if prog_deficit is not None and prog_deficit > 0.0:
        contributing_factors.append("PROGRESS_SHORTFALL")
        evidence_list.append(
            f"Progress Shortfall: Activity achieved {prog_pct}%, exhibiting a {prog_deficit}% deficit "
            f"against planned baseline expectations."
        )

    # 3. Check Quantity Shortfall
    if qty_variance is not None and qty_variance < 0.0:
        contributing_factors.append("QUANTITY_SHORTFALL")
        evidence_list.append(
            f"Quantity Shortfall: Installed actual quantity of {actual_qty:,.1f} {unit} vs planned "
            f"{planned_qty:,.1f} {unit} results in a physical execution shortfall of {abs(qty_variance):,.1f} {unit}."
        )

    # 4. Check Critical Path Exposure / Low Float
    if is_critical or (total_float is not None and total_float == 0):
        contributing_factors.append("CRITICAL_PATH_EXPOSURE")
        evidence_list.append(
            "Critical Path Exposure: Activity is driving the critical path with zero total float; "
            "any rate deficit directly extends the project completion timeline."
        )
    elif total_float is not None and total_float < 5:
        contributing_factors.append("LOW_FLOAT")
        evidence_list.append(
            f"Low Float Sensitivity: Total float is limited to {total_float} days, leaving minimal buffer "
            f"against critical path encroachment."
        )

    # 5. Check Predecessor Cascade Risk
    # Find all predecessors from dependencies
    sched_preds = [
        d.get("predecessor_activity_id") or d.get("predecessor_id")
        for d in dependencies
        if (normalize_id(d.get("successor_activity_id")) == norm_sid or normalize_id(d.get("successor_id")) == norm_sid)
        and (d.get("validation_status") == "VALID" or d.get("status") == "VALID")
    ]
    delayed_preds_info = []
    for pid in sched_preds:
        norm_pid = normalize_id(pid)
        p_act = activities_by_sched_id.get(norm_pid)
        if p_act:
            p_status = p_act.get("status") or ""
            p_prog = p_act.get("progress_percent")
            if p_status == "BEHIND" or (p_prog is not None and p_prog < 100.0):
                delayed_preds_info.append({
                    "id": p_act.get("execution_activity_id") or pid,
                    "name": p_act.get("execution_activity_name") or pid,
                    "status": p_status,
                    "progress": p_prog
                })

    if delayed_preds_info:
        contributing_factors.append("PREDECESSOR_RISK")
        for dp in delayed_preds_info:
            evidence_list.append(
                f"Predecessor Cascade Risk: Direct predecessor activity {dp['id']} ({dp['name']}) "
                f"is currently {dp['status']} ({dp['progress']}% achieved), cascading upstream delay into this activity."
            )

    # 6. Check Parent Milestone Context
    if ms_risk == "HIGH":
        contributing_factors.append("MILESTONE_RISK")
        evidence_list.append(
            f"Milestone Risk Exposure: Activity directly supports high-risk parent milestone "
            f"{ms_id} ({ms_name}), which has multiple delayed critical path activities."
        )

    # 7. Category Assignment
    if len(contributing_factors) >= 2:
        root_cause_category = "MULTIPLE_CONTRIBUTING_FACTORS"
    elif len(contributing_factors) == 1:
        root_cause_category = contributing_factors[0]
    else:
        root_cause_category = "INSUFFICIENT_EVIDENCE"

    # 8. Deterministic Confidence Formulation (0-100 scale)
    base_conf = 50.0
    if qty_variance is not None:
        base_conf += 15.0
    if prog_deficit is not None and prog_deficit > 0:
        base_conf += 15.0
    if total_float is not None:
        base_conf += 10.0
    if ms_risk is not None:
        base_conf += 10.0

    confidence = min(100.0, max(0.0, round(base_conf, 1)))

    return {
        "activity_id": eid,
        "activity_name": ename,
        "schedule_activity_id": sid,
        "schedule_level": level,
        "discipline": discipline,
        "current_delay_status": current_status,
        "current_severity": severity,
        "progress_percent": prog_pct,
        "progress_deficit": prog_deficit,
        "quantity_variance": qty_variance,
        "critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
        "total_float": total_float,
        "milestone_id": ms_id,
        "milestone_risk": ms_risk,
        "root_cause_category": root_cause_category,
        "root_cause_confidence": confidence,
        "contributing_factors": contributing_factors,
        "evidence": evidence_list,
        "analysis_status": "VALID"
    }


def get_root_cause_analysis_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.20: Root Cause Analysis Service.
    - Evaluates delayed or high/medium delay risk activities.
    - Correlates verified evidence across pipeline layers (deficits, float, dependencies, milestones).
    - Assigns deterministic root cause categories and explainable evidence citations.
    - Strictly read-only and analytical (zero database mutations).
    """
    # 1. Retrieve Delay Detection results (Feature 2.17)
    delay_res = get_delay_detection_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    delay_activities = delay_res.get("activities", [])

    # Index by schedule activity ID for dependency lookups
    activities_by_sched_id: Dict[str, Dict[str, Any]] = {}
    for a in delay_activities:
        sid = normalize_id(a.get("schedule_activity_id"))
        if sid:
            activities_by_sched_id[sid] = a

    # 2. Retrieve Schedule Dependencies (Feature 2.15)
    dep_res = get_schedule_dependencies(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    dependencies = dep_res.get("dependencies", [])

    # 3. Retrieve Schedule Health & Milestone context (Feature 2.18)
    health_res = get_schedule_health_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    milestone_map: Dict[str, Dict[str, Any]] = {}
    for ms in health_res.get("milestones", []):
        ms_id = ms.get("milestone_id")
        ms_name = ms.get("milestone_name")
        ms_risk = ms.get("risk_level")
        ms_status = ms.get("status")

        src_id = normalize_id(ms.get("source_activity_id"))
        if src_id:
            milestone_map[src_id] = {
                "milestone_id": ms_id,
                "milestone_name": ms_name,
                "risk_level": ms_risk,
                "status": ms_status
            }
        for supp in ms.get("supporting_activities", []):
            supp_id = normalize_id(supp.get("activity_id"))
            if supp_id:
                milestone_map[supp_id] = {
                    "milestone_id": ms_id,
                    "milestone_name": ms_name,
                    "risk_level": ms_risk,
                    "status": ms_status
                }

    # 4. Retrieve Delay Prediction results (Feature 2.19)
    pred_res = get_delay_prediction_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    pred_map = {p.get("activity_id"): p for p in pred_res.get("predictions", [])}

    # 5. Filter to eligible delayed or at-risk activities
    analyzed_activities: List[Dict[str, Any]] = []

    multiple_factors_count = 0
    severe_count = 0
    pred_risk_count = 0
    insufficient_count = 0
    valid_confidences: List[float] = []

    for act in delay_activities:
        eid = act.get("execution_activity_id") or ""
        pred_info = pred_map.get(eid, {})

        is_behind = (act.get("status") == "BEHIND")
        is_at_risk = (pred_info.get("predicted_delay_risk") in ("HIGH", "MEDIUM") or
                      pred_info.get("prediction_status") in ("HIGH_RISK", "MEDIUM_RISK"))

        # Only evaluate eligible delayed or risk activities
        if not (is_behind or is_at_risk):
            continue

        result = analyze_activity_root_cause(
            activity=act,
            pred_info=pred_info,
            dependencies=dependencies,
            activities_by_sched_id=activities_by_sched_id,
            milestone_map=milestone_map
        )

        cat = result["root_cause_category"]
        conf = result["root_cause_confidence"]

        if cat == "MULTIPLE_CONTRIBUTING_FACTORS":
            multiple_factors_count += 1
        elif cat == "INSUFFICIENT_EVIDENCE":
            insufficient_count += 1

        if result.get("current_severity") == "SEVERE":
            severe_count += 1

        if "PREDECESSOR_RISK" in result.get("contributing_factors", []):
            pred_risk_count += 1

        if conf is not None:
            valid_confidences.append(conf)

        analyzed_activities.append(result)

    avg_conf = round(sum(valid_confidences) / len(valid_confidences), 1) if valid_confidences else None

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "summary": {
            "total_analyzed": len(analyzed_activities),
            "multiple_contributing_factors_count": multiple_factors_count,
            "high_severity_count": severe_count,
            "predecessor_risk_count": pred_risk_count,
            "insufficient_evidence_count": insufficient_count,
            "average_confidence": avg_conf
        },
        "activities": analyzed_activities
    }
