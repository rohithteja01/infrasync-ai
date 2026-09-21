import copy
from typing import Dict, Any, List, Optional, Tuple

from app.services.recovery_plans import get_recovery_plans_results


ALLOWED_RECOVERY_TYPES = {"DURATION_REDUCTION", "PARALLEL_EXECUTION", "START_ADVANCEMENT"}
TIE_BREAK_ORDER = {
    "DURATION_REDUCTION": 0,
    "PARALLEL_EXECUTION": 1,
    "START_ADVANCEMENT": 2
}


def calculate_recommendation_score(
    plan_entry: Dict[str, Any],
    scenario: Dict[str, Any]
) -> Tuple[float, Dict[str, float]]:
    """
    Deterministically computes a normalized recommendation score (0 - 100)
    for a recovery scenario based on 7 quantitative analytical factors:
    1. Project finish recovery days (max 35 pts)
    2. Critical-path status (max 20 pts)
    3. Delay severity (max 15 pts)
    4. Delay prediction risk (max 10 pts)
    5. Milestone exposure (max 10 pts)
    6. Feasibility status (max 5 pts)
    7. Float improvement (max 5 pts)
    """
    # 1. Project finish recovery days (max 35 pts)
    recovery_days = max(0, scenario.get("project_finish_recovery_days", 0))
    score_rec = min(35.0, (recovery_days / 5.0) * 35.0)

    # 2. Critical-path status (max 20 pts)
    is_critical = (plan_entry.get("critical_path_status") == "CRITICAL")
    score_crit = 20.0 if is_critical else 0.0

    # 3. Delay severity (max 15 pts)
    sev = str(plan_entry.get("delay_severity", "")).upper()
    score_sev = {"SEVERE": 15.0, "MODERATE": 10.0, "MINOR": 5.0}.get(sev, 0.0)

    # 4. Delay prediction risk (max 10 pts)
    risk = str(plan_entry.get("delay_prediction_risk", "")).upper()
    score_risk = {"HIGH": 10.0, "MEDIUM": 6.0, "LOW": 2.0}.get(risk, 0.0)

    # 5. Milestone exposure (max 10 pts)
    has_ms = bool(plan_entry.get("milestone"))
    if has_ms:
        score_ms = 10.0 if recovery_days > 0 else 5.0
    else:
        score_ms = 0.0

    # 6. Feasibility quality (max 5 pts)
    feas = str(scenario.get("feasibility_status", "")).upper()
    score_feas = {"FEASIBLE": 5.0, "CONSTRAINED": 3.0, "HIGH_COMPACTION": 2.0}.get(feas, 1.0)

    # 7. Float improvement (max 5 pts)
    fl_before = scenario.get("float_before", 0)
    fl_after = scenario.get("float_after", 0)
    if (fl_after > fl_before) or (is_critical and fl_after >= 0 and recovery_days > 0):
        score_fl = 5.0
    else:
        score_fl = 0.0

    total_score = min(100.0, max(0.0, score_rec + score_crit + score_sev + score_risk + score_ms + score_feas + score_fl))

    breakdown = {
        "project_finish_recovery": round(score_rec, 1),
        "critical_path_status": round(score_crit, 1),
        "delay_severity": round(score_sev, 1),
        "delay_prediction_risk": round(score_risk, 1),
        "milestone_exposure": round(score_ms, 1),
        "feasibility_quality": round(score_feas, 1),
        "float_improvement": round(score_fl, 1),
        "total_score": round(total_score, 1)
    }

    return round(total_score, 1), breakdown


def generate_recommendation_reason(
    plan: Dict[str, Any],
    recommended_scenario: Optional[Dict[str, Any]],
    score: float,
    score_breakdown: Optional[Dict[str, float]] = None
) -> str:
    """
    Generates a deterministic, quantitative explanation for why a recovery scenario
    was selected as the primary recommendation. Strictly references verified metrics
    with zero hallucinated external factors.
    """
    if not recommended_scenario:
        status = plan.get("current_status", "UNKNOWN")
        progress = plan.get("current_progress", 0.0)
        float_days = plan.get("available_float", 0)
        priority = plan.get("recovery_priority", "LOW")
        if priority == "INSUFFICIENT_DATA":
            return "Insufficient schedule or execution linkage data to calculate deterministic recovery recommendations."
        return (
            f"Activity status is {status} with {progress:.1f}% progress and {float_days}d total float. "
            f"No recovery intervention required; maintain standard execution tracking."
        )

    rec_type = recommended_scenario.get("recovery_type")
    rec_val = recommended_scenario.get("recovery_value")
    rec_days = recommended_scenario.get("project_finish_recovery_days", 0)
    crit_status = plan.get("critical_path_status", "NON_CRITICAL")
    delay_sev = plan.get("delay_severity", "NO_DELAY")
    pred_risk = plan.get("delay_prediction_risk", "LOW")
    feas = recommended_scenario.get("feasibility_status", "FEASIBLE")
    proj_before = recommended_scenario.get("project_finish_before", "N/A")
    proj_after = recommended_scenario.get("project_finish_after", "N/A")
    fl_before = recommended_scenario.get("float_before", 0)
    fl_after = recommended_scenario.get("float_after", 0)

    type_names = {
        "DURATION_REDUCTION": f"Duration Reduction ({rec_val}d compression)",
        "PARALLEL_EXECUTION": f"Parallel Execution ({rec_val}d overlap)",
        "START_ADVANCEMENT": f"Start Advancement ({rec_val}d earlier start)"
    }
    lever_desc = type_names.get(rec_type, f"{rec_type} ({rec_val}d)")

    parts = [
        f"Recommended lever '{lever_desc}' achieves score {score:.1f}/100."
    ]

    if rec_days > 0:
        parts.append(
            f"Recovers {rec_days}d on overall project finish ({proj_before} -> {proj_after}) "
            f"for {crit_status.lower().replace('_', '-')} activity with {delay_sev.lower()} delay and {pred_risk.lower()} predicted risk."
        )
    else:
        parts.append(
            f"Absorbed within schedule buffer (float increased from {fl_before}d to {fl_after}d) "
            f"with project finish maintained at {proj_before} for {crit_status.lower().replace('_', '-')} activity."
        )

    ms = plan.get("milestone")
    if ms and isinstance(ms, dict) and ms.get("id"):
        parts.append(f"Protects milestone {ms.get('id')} ({ms.get('name', '')}).")

    parts.append(f"Feasibility classified as {feas}.")
    return " ".join(parts)


def determine_recommendation_priority(
    plan: Dict[str, Any],
    recommended_scenario: Optional[Dict[str, Any]],
    score: float
) -> str:
    """
    Deterministically assigns recommendation priority (HIGH, MEDIUM, LOW, INSUFFICIENT_DATA)
    aligned with the recovery plan priority and normalized recommendation score.
    """
    plan_pri = plan.get("recovery_priority", "LOW")
    if plan_pri == "INSUFFICIENT_DATA":
        return "INSUFFICIENT_DATA"
    if not recommended_scenario:
        return plan_pri

    if plan_pri == "HIGH" or score >= 65.0:
        return "HIGH"
    if plan_pri == "MEDIUM" or score >= 35.0:
        return "MEDIUM"
    return "LOW"


def get_recommendations_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.24: Recommendations Service.
    - Consumes existing recovery plans from Feature 2.23 (get_recovery_plans_results).
    - Never invents new recovery actions; strictly selects and ranks existing recovery scenarios.
    - Evaluates recovery options using a normalized 7-factor deterministic scoring model.
    - Applies deterministic tie-breaking (DURATION_REDUCTION -> PARALLEL_EXECUTION -> START_ADVANCEMENT).
    - Classifies priority: HIGH, MEDIUM, LOW, INSUFFICIENT_DATA.
    - Synthesizes strictly quantitative evidence-based recommendation reasons.
    - In-memory only; zero database or schedule mutations.
    """
    # 1. Fetch Recovery Plans results from Feature 2.23
    recovery_plans_data = get_recovery_plans_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    plans = recovery_plans_data.get("recovery_plans", [])

    recommendations: List[Dict[str, Any]] = []
    priority_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "INSUFFICIENT_DATA": 0}
    total_evaluated_count = 0
    max_recovery_days = 0

    for plan in plans:
        scenarios = plan.get("scenarios", [])
        evaluated_scenarios: List[Dict[str, Any]] = []

        for scen in scenarios:
            scen_copy = copy.deepcopy(scen)
            scen_score, scen_breakdown = calculate_recommendation_score(plan, scen)
            scen_copy["recommendation_score"] = scen_score
            scen_copy["score_breakdown"] = scen_breakdown
            evaluated_scenarios.append(scen_copy)
            total_evaluated_count += 1

        # Deterministic sorting for scenarios:
        # 1. Score descending
        # 2. Lever precedence: DURATION_REDUCTION -> PARALLEL_EXECUTION -> START_ADVANCEMENT
        # 3. Recovery value descending
        evaluated_scenarios.sort(
            key=lambda s: (
                -s["recommendation_score"],
                TIE_BREAK_ORDER.get(s.get("recovery_type"), 99),
                -s.get("recovery_value", 0)
            )
        )

        best_scenario = evaluated_scenarios[0] if evaluated_scenarios else None
        best_score = best_scenario["recommendation_score"] if best_scenario else 0.0
        best_breakdown = best_scenario["score_breakdown"] if best_scenario else None

        if best_scenario:
            max_recovery_days = max(
                max_recovery_days,
                best_scenario.get("project_finish_recovery_days", 0)
            )

        priority = determine_recommendation_priority(plan, best_scenario, best_score)
        priority_counts[priority] += 1

        reason = generate_recommendation_reason(plan, best_scenario, best_score, best_breakdown)

        rec_item = {
            "activity_id": plan.get("activity_id"),
            "execution_activity_id": plan.get("execution_activity_id"),
            "schedule_activity_id": plan.get("schedule_activity_id"),
            "activity_name": plan.get("activity_name"),
            "discipline": plan.get("discipline"),
            "level": plan.get("level"),
            "current_status": plan.get("current_status"),
            "delay_severity": plan.get("delay_severity"),
            "delay_prediction_risk": plan.get("delay_prediction_risk"),
            "current_progress": plan.get("current_progress"),
            "current_duration": plan.get("current_duration"),
            "baseline_finish": plan.get("baseline_finish"),
            "critical_path_status": plan.get("critical_path_status"),
            "available_float": plan.get("available_float"),
            "milestone": plan.get("milestone"),
            "impact_summary": plan.get("impact_summary"),
            "root_cause_category": plan.get("root_cause_category"),
            "recovery_priority": priority,
            "recommendation_score": best_score,
            "score_breakdown": best_breakdown,
            "recommended_scenario": best_scenario,
            "all_evaluated_scenarios": evaluated_scenarios,
            "recommendation_reason": reason
        }
        recommendations.append(rec_item)

    # Sort recommendations: HIGH priority first, then MEDIUM, LOW, INSUFFICIENT_DATA;
    # within priority sort by recommendation_score descending, then activity_id
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INSUFFICIENT_DATA": 3}
    recommendations.sort(
        key=lambda r: (
            priority_order.get(r["recovery_priority"], 99),
            -r["recommendation_score"],
            r["activity_id"]
        )
    )

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "is_hypothetical": True,
        "in_memory_only": True,
        "baseline_schedule_modified": False,
        "database_modified": False,
        "disclaimer": "HYPOTHETICAL RECOMMENDATIONS — BASELINE SCHEDULE REMAINS UNMODIFIED (READ-ONLY ANALYTICAL SELECTION)",
        "summary": {
            "total_recommendations": len(recommendations),
            "high_priority_count": priority_counts["HIGH"],
            "medium_priority_count": priority_counts["MEDIUM"],
            "low_priority_count": priority_counts["LOW"],
            "insufficient_data_count": priority_counts["INSUFFICIENT_DATA"],
            "total_scenarios_evaluated": total_evaluated_count,
            "max_project_recovery_days": max_recovery_days
        },
        "recommendations": recommendations
    }
