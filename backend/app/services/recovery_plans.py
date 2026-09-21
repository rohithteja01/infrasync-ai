import copy
from datetime import date, timedelta
from typing import Dict, Any, List, Set, Optional, Tuple

from app.services.matching import normalize_id
from app.services.critical_path import (
    calculate_critical_path,
    parse_iso_date,
    parse_duration_days
)
from app.services.schedule_dependencies import get_schedule_dependencies
from app.services.delay_detection import get_delay_detection_results
from app.services.schedule_health import get_schedule_health_results
from app.services.delay_prediction import get_delay_prediction_results
from app.services.root_cause_analysis import get_root_cause_analysis_results
from app.services.impact_propagation import get_impact_propagation_results


ALLOWED_RECOVERY_TYPES = {"DURATION_REDUCTION", "PARALLEL_EXECUTION", "START_ADVANCEMENT"}


def calculate_recovery_priority(
    is_critical: bool,
    delay_severity: str,
    delay_prediction_risk: str,
    milestone_impact: bool,
    project_duration_exposure: bool,
    total_affected_activities: int
) -> str:
    """
    Deterministically calculates recovery priority using existing analytical evidence.

    HIGH:
    - Critical path
    - Severe delay
    - High delay-prediction risk
    - Milestone or project-duration exposure

    MEDIUM:
    - Critical or moderate delay
    - Meaningful downstream impact (>= 1 affected activities)

    LOW:
    - Non-critical and limited impact

    INSUFFICIENT_DATA:
    - Handled prior to this function if inputs are missing/corrupt.
    """
    sev_upper = str(delay_severity).upper()
    risk_upper = str(delay_prediction_risk).upper()

    # HIGH PRIORITY CRITERIA:
    # 1. Critical path with severe delay OR high risk OR project duration exposure
    if is_critical and (
        sev_upper == "SEVERE" or
        risk_upper == "HIGH" or
        project_duration_exposure or
        milestone_impact
    ):
        return "HIGH"

    # 2. Severe delay with milestone impact even if non-critical
    if sev_upper == "SEVERE" and (milestone_impact or project_duration_exposure):
        return "HIGH"

    # MEDIUM PRIORITY CRITERIA:
    # 1. Critical path with moderate delay or medium risk
    if is_critical or sev_upper in ("MODERATE", "SEVERE"):
        return "MEDIUM"

    if total_affected_activities > 0 or risk_upper in ("HIGH", "MEDIUM"):
        return "MEDIUM"

    # LOW PRIORITY CRITERIA:
    return "LOW"


def simulate_recovery_lever(
    schedule_activities: List[Dict[str, Any]],
    target_sched_id: str,
    recovery_type: str,
    recovery_value: int,
    baseline_cpm: Dict[str, Any],
    valid_deps: List[Dict[str, Any]],
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Executes a single in-memory recovery lever simulation on a deep copy of schedule activities.
    Recalculates downstream successor dates along the dependency DAG and computes CPM.
    Strictly in memory — zero database or schedule mutations.
    """
    if recovery_value <= 0:
        raise ValueError(f"Recovery value must be greater than 0, got {recovery_value}.")

    clean_type = str(recovery_type).strip().upper()
    if clean_type not in ALLOWED_RECOVERY_TYPES:
        raise ValueError(f"Invalid recovery type '{recovery_type}'. Allowed: {sorted(ALLOWED_RECOVERY_TYPES)}")

    # Deepcopy to guarantee 100% baseline schedule isolation
    hypo_acts = copy.deepcopy(schedule_activities)

    # Index activities
    norm_target = normalize_id(target_sched_id)
    target_act = None
    act_by_norm: Dict[str, Dict[str, Any]] = {}
    for a in hypo_acts:
        nid = normalize_id(a.get("activity_id"))
        if nid:
            act_by_norm[nid] = a
            if nid == norm_target:
                target_act = a

    if not target_act:
        raise KeyError(f"Target schedule activity '{target_sched_id}' not found in schedule.")

    # Extract current timing
    orig_start = parse_iso_date(target_act.get("planned_start"))
    orig_finish = parse_iso_date(target_act.get("planned_finish"))
    orig_dur = parse_duration_days(target_act.get("duration"))

    if not orig_start or not orig_finish or orig_dur <= 0:
        raise ValueError(f"Activity '{target_sched_id}' has invalid dates or duration.")

    # Graph adjacency and lags
    preds: Dict[str, List[str]] = {nid: [] for nid in act_by_norm}
    succs: Dict[str, List[str]] = {nid: [] for nid in act_by_norm}
    lags: Dict[Tuple[str, str], int] = {}

    for d in valid_deps:
        p_nid = normalize_id(d.get("predecessor_activity_id"))
        s_nid = normalize_id(d.get("successor_activity_id"))
        if p_nid in act_by_norm and s_nid in act_by_norm:
            preds[s_nid].append(p_nid)
            succs[p_nid].append(s_nid)
            p_orig_fin = parse_iso_date(act_by_norm[p_nid].get("planned_finish"))
            s_orig_str = parse_iso_date(act_by_norm[s_nid].get("planned_start"))
            lags[(p_nid, s_nid)] = (s_orig_str - p_orig_fin).days if (p_orig_fin and s_orig_str) else 0

    # Project overall start boundary
    all_starts = [parse_iso_date(a.get("planned_start")) for a in hypo_acts if parse_iso_date(a.get("planned_start"))]
    proj_start_boundary = min(all_starts) if all_starts else date(2025, 1, 1)

    # Apply recovery lever to target activity
    feasibility_status = "FEASIBLE"
    explanation_parts = []

    if clean_type == "DURATION_REDUCTION":
        max_reduction = max(1, orig_dur - 1)
        actual_reduction = min(recovery_value, max_reduction)
        new_dur = orig_dur - actual_reduction
        if new_dur < 1:
            new_dur = 1
            actual_reduction = orig_dur - 1
            feasibility_status = "CONSTRAINED"
        elif actual_reduction >= orig_dur * 0.5:
            feasibility_status = "HIGH_COMPACTION"

        new_start = orig_start
        new_finish = new_start + timedelta(days=new_dur)
        target_act["duration"] = new_dur
        target_act["planned_start"] = new_start.isoformat()
        target_act["planned_finish"] = new_finish.isoformat()

        explanation_parts.append(
            f"Duration reduced by {actual_reduction}d (from {orig_dur}d to {new_dur}d)"
        )

    elif clean_type == "PARALLEL_EXECUTION":
        # Overlap with predecessor: pull start earlier by recovery_value days
        # Constrained by project start boundary
        actual_shift = recovery_value
        cand_start = orig_start - timedelta(days=actual_shift)
        if cand_start < proj_start_boundary:
            cand_start = proj_start_boundary
            actual_shift = (orig_start - cand_start).days
            feasibility_status = "CONSTRAINED"
        elif actual_shift > 5:
            feasibility_status = "HIGH_COMPACTION"

        new_start = cand_start
        new_finish = new_start + timedelta(days=orig_dur)
        target_act["planned_start"] = new_start.isoformat()
        target_act["planned_finish"] = new_finish.isoformat()

        explanation_parts.append(
            f"Parallel overlapping modeled by advancing start by {actual_shift}d relative to predecessor"
        )

    elif clean_type == "START_ADVANCEMENT":
        # Advance activity start earlier by recovery_value days
        actual_shift = recovery_value
        cand_start = orig_start - timedelta(days=actual_shift)
        if cand_start < proj_start_boundary:
            cand_start = proj_start_boundary
            actual_shift = (orig_start - cand_start).days
            feasibility_status = "CONSTRAINED"
        elif actual_shift > 5:
            feasibility_status = "HIGH_COMPACTION"

        new_start = cand_start
        new_finish = new_start + timedelta(days=orig_dur)
        target_act["planned_start"] = new_start.isoformat()
        target_act["planned_finish"] = new_finish.isoformat()

        explanation_parts.append(
            f"Activity start advanced by {actual_shift}d (from {orig_start.isoformat()} to {new_start.isoformat()})"
        )

    # Forward topological propagation for downstream successors
    in_degree = {nid: len(preds[nid]) for nid in act_by_norm}
    topo_q = [nid for nid, deg in in_degree.items() if deg == 0]
    topo_order = []
    while topo_q:
        curr = topo_q.pop(0)
        topo_order.append(curr)
        for s in succs[curr]:
            in_degree[s] -= 1
            if in_degree[s] == 0:
                topo_q.append(s)

    # Recalculate earliest possible starts for successors if predecessor finishes earlier
    for nid in topo_order:
        if nid == norm_target:
            continue
        act = act_by_norm[nid]
        if not preds[nid]:
            continue

        # Candidate starts from all predecessors
        pred_finishes = []
        for p in preds[nid]:
            p_fin = parse_iso_date(act_by_norm[p].get("planned_finish"))
            if p_fin:
                pred_finishes.append(p_fin + timedelta(days=lags.get((p, nid), 0)))

        if pred_finishes:
            earliest_allowed = max(pred_finishes)
            cur_dur = parse_duration_days(act.get("duration"))
            act["planned_start"] = earliest_allowed.isoformat()
            act["planned_finish"] = (earliest_allowed + timedelta(days=cur_dur)).isoformat()

    # Synchronize L5 summary activities to span their L6 children
    for l5_id, l6_prefix in [("CIV-L5-01", "CIV-L6"), ("PIP-L5-01", "PIP-L6"), ("MEC-L5-01", "MEC-L6")]:
        l6_acts = [a for a in hypo_acts if str(a.get("activity_id", "")).startswith(l6_prefix)]
        l5_act = next((a for a in hypo_acts if a.get("activity_id") == l5_id), None)
        if l5_act and l6_acts:
            l6_starts = [parse_iso_date(a.get("planned_start")) for a in l6_acts if parse_iso_date(a.get("planned_start"))]
            l6_finishes = [parse_iso_date(a.get("planned_finish")) for a in l6_acts if parse_iso_date(a.get("planned_finish"))]
            if l6_starts and l6_finishes:
                l5_s = min(l6_starts)
                l5_f = max(l6_finishes)
                l5_act["planned_start"] = l5_s.isoformat()
                l5_act["planned_finish"] = l5_f.isoformat()
                l5_act["duration"] = (l5_f - l5_s).days

    # Recompute CPM on hypothetical schedule copy
    hypo_cpm = calculate_critical_path(hypo_acts, schedule_filename)

    base_summary = baseline_cpm.get("summary", {})
    hypo_summary = hypo_cpm.get("summary", {})

    base_proj_fin = parse_iso_date(base_summary.get("project_finish"))
    hypo_proj_fin = parse_iso_date(hypo_summary.get("project_finish"))

    proj_finish_recovery_days = 0
    if base_proj_fin and hypo_proj_fin:
        proj_finish_recovery_days = max(0, (base_proj_fin - hypo_proj_fin).days)

    # Activity level float and criticality
    base_act_cpm = next((a for a in baseline_cpm.get("activities", []) if normalize_id(a.get("activity_id")) == norm_target), {})
    hypo_act_cpm = next((a for a in hypo_cpm.get("activities", []) if normalize_id(a.get("activity_id")) == norm_target), {})

    float_before = base_act_cpm.get("total_float", 0)
    float_after = hypo_act_cpm.get("total_float", 0)

    crit_before = [a.get("activity_id") for a in baseline_cpm.get("activities", []) if a.get("is_critical")]
    crit_after = [a.get("activity_id") for a in hypo_cpm.get("activities", []) if a.get("is_critical")]

    # Construct final explanation
    if proj_finish_recovery_days > 0:
        explanation_parts.append(
            f"Recovers {proj_finish_recovery_days}d on overall project finish ({base_summary.get('project_finish')} -> {hypo_summary.get('project_finish')})."
        )
    else:
        explanation_parts.append(
            f"Absorbed within local float buffer; project finish unchanged ({base_summary.get('project_finish')}). Float increased from {float_before}d to {float_after}d."
        )

    explanation = " ".join(explanation_parts)

    return {
        "recovery_type": clean_type,
        "recovery_value": recovery_value,
        "affected_activity_id": target_act.get("activity_id"),
        "hypothetical_finish": target_act.get("planned_finish"),
        "project_finish_before": base_summary.get("project_finish"),
        "project_finish_after": hypo_summary.get("project_finish"),
        "project_finish_recovery_days": proj_finish_recovery_days,
        "float_before": float_before,
        "float_after": float_after,
        "critical_path_before": crit_before,
        "critical_path_after": crit_after,
        "feasibility_status": feasibility_status,
        "explanation": explanation
    }


def get_recovery_plans_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.23: Recovery Plans Service.
    - Consumes existing analytical layers (2.14 through 2.22).
    - Identifies eligible delayed or high-risk linked activities.
    - Assigns deterministic recovery priority (HIGH, MEDIUM, LOW, INSUFFICIENT_DATA).
    - Simulates deterministic in-memory recovery scenarios across controlled levers:
      1. DURATION_REDUCTION
      2. PARALLEL_EXECUTION
      3. START_ADVANCEMENT
    - Recomputes CPM, project finish recovery days, float shifts, and milestone impact.
    - Strictly read-only analytical view (zero database writes, zero schedule file writes).
    """
    # 1. Baseline Dependencies (Feature 2.15)
    dep_res = get_schedule_dependencies(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    valid_deps = [d for d in dep_res.get("dependencies", []) if d.get("validation_status") == "VALID"]

    # 2. Baseline CPM (Feature 2.16)
    baseline_cpm = calculate_critical_path(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    cpm_map = {normalize_id(a.get("activity_id")): a for a in baseline_cpm.get("activities", [])}

    # 3. Delay Detection (Feature 2.17)
    delay_res = get_delay_detection_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    delay_map = {a.get("execution_activity_id"): a for a in delay_res.get("activities", [])}

    # 4. Schedule Health & Milestones (Feature 2.18)
    health_res = get_schedule_health_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    milestone_map: Dict[str, Dict[str, Any]] = {}
    for ms in health_res.get("milestones", []):
        ms_id = ms.get("milestone_id")
        ms_name = ms.get("milestone_name") or ms_id
        src_id = normalize_id(ms.get("source_activity_id"))
        if src_id:
            milestone_map[src_id] = {"id": ms_id, "name": ms_name, "status": ms.get("status")}
        for supp in ms.get("supporting_activities", []):
            supp_id = normalize_id(supp.get("activity_id"))
            if supp_id:
                milestone_map[supp_id] = {"id": ms_id, "name": ms_name, "status": ms.get("status")}

    # 5. Delay Prediction (Feature 2.19)
    pred_res = get_delay_prediction_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    pred_map = {p.get("activity_id"): p for p in pred_res.get("predictions", [])}

    # 6. Root Cause Analysis (Feature 2.20)
    rca_res = get_root_cause_analysis_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    rca_map = {r.get("activity_id"): r for r in rca_res.get("activities", [])}

    # 7. Impact Propagation (Feature 2.21)
    impact_res = get_impact_propagation_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    impact_map = {p.get("source_activity_id"): p for p in impact_res.get("propagation", [])}

    # 8. Index baseline schedule activities
    sched_act_map = {normalize_id(a.get("activity_id")): a for a in schedule_activities}

    # 9. Evaluate Eligible Activities
    plans: List[Dict[str, Any]] = []
    total_scenarios_count = 0
    max_recoverable_days = 0
    priority_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "INSUFFICIENT_DATA": 0}

    # Linked activities to evaluate
    for eid, delay_act in delay_map.items():
        sid = delay_act.get("schedule_activity_id") or eid
        norm_sid = normalize_id(sid)
        sched_act = sched_act_map.get(norm_sid)

        # Skip activities with no schedule activity found
        if not sched_act:
            continue

        cpm_info = cpm_map.get(norm_sid, {})
        pred_info = pred_map.get(eid, {})
        rca_info = rca_map.get(eid, {})
        impact_info = impact_map.get(eid, {})
        ms_info = milestone_map.get(norm_sid, {})

        is_critical = bool(cpm_info.get("is_critical", False))
        curr_status = delay_act.get("status", "NOT_STARTED")
        delay_sev = delay_act.get("severity", "NO_DELAY")
        pred_risk = pred_info.get("predicted_delay_risk", "LOW")
        curr_progress = delay_act.get("progress_percent", 0.0)
        curr_dur = parse_duration_days(sched_act.get("duration"))
        base_finish = cpm_info.get("planned_finish") or str(sched_act.get("planned_finish"))
        avail_float = cpm_info.get("total_float", 0)
        rca_cat = rca_info.get("root_cause_category", "NONE")

        # Insufficient data check
        if not curr_dur or curr_dur <= 0 or not base_finish or base_finish == "None":
            plans.append({
                "activity_id": eid,
                "execution_activity_id": eid,
                "schedule_activity_id": sid,
                "activity_name": delay_act.get("execution_activity_name") or sched_act.get("activity_name") or eid,
                "discipline": sched_act.get("discipline") or delay_act.get("discipline") or "General",
                "level": sched_act.get("level") or "L6",
                "current_status": curr_status,
                "delay_severity": delay_sev,
                "delay_prediction_risk": pred_risk,
                "current_progress": curr_progress,
                "current_duration": curr_dur,
                "baseline_finish": base_finish,
                "critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
                "available_float": avail_float,
                "milestone": ms_info,
                "root_cause_category": rca_cat,
                "impact_summary": "Insufficient data to model downstream exposure",
                "recovery_priority": "INSUFFICIENT_DATA",
                "scenarios": []
            })
            priority_counts["INSUFFICIENT_DATA"] += 1
            continue

        # Check if delayed or at-risk
        is_delayed = (curr_status == "BEHIND")
        is_at_risk = (pred_risk in ("HIGH", "MEDIUM"))
        is_completed = (curr_status in ("COMPLETED", "ON_PLAN") and curr_progress >= 100.0)

        # Summary of downstream impact
        tot_aff = impact_info.get("total_affected_activities", 0)
        has_ms_impact = bool(impact_info.get("milestone_impact", False))
        has_proj_exp = bool(impact_info.get("project_duration_exposure", False))

        if tot_aff > 0:
            aff_names = [a.get("activity_id") for a in impact_info.get("affected_activities", [])]
            impact_summary = (
                f"{tot_aff} downstream activities exposed ({', '.join(aff_names[:4])}"
                f"{'...' if len(aff_names) > 4 else ''}); "
                f"Milestone impact: {has_ms_impact}; Project finish exposure: {has_proj_exp}"
            )
        else:
            impact_summary = "No downstream activities exposed"

        # Calculate Priority
        if is_completed:
            priority = "LOW"
        else:
            priority = calculate_recovery_priority(
                is_critical=is_critical,
                delay_severity=delay_sev,
                delay_prediction_risk=pred_risk,
                milestone_impact=has_ms_impact,
                project_duration_exposure=has_proj_exp,
                total_affected_activities=tot_aff
            )

        priority_counts[priority] += 1

        # Generate Scenarios if delayed or at-risk
        scenarios: List[Dict[str, Any]] = []

        if is_delayed or is_at_risk or is_critical:
            # Lever 1: DURATION_REDUCTION
            # Test reduction of 20% to 33%, capped sensibly
            reduc_val = max(1, min(5, int(round(curr_dur * 0.25))))
            if curr_dur > 1:
                try:
                    scen1 = simulate_recovery_lever(
                        schedule_activities=schedule_activities,
                        target_sched_id=sid,
                        recovery_type="DURATION_REDUCTION",
                        recovery_value=reduc_val,
                        baseline_cpm=baseline_cpm,
                        valid_deps=valid_deps,
                        schedule_filename=schedule_filename
                    )
                    scen1["milestone_impact"] = ms_info
                    scenarios.append(scen1)
                    total_scenarios_count += 1
                    max_recoverable_days = max(max_recoverable_days, scen1.get("project_finish_recovery_days", 0))
                except Exception:
                    pass

            # Lever 2: PARALLEL_EXECUTION
            par_val = max(1, min(4, curr_dur // 3))
            try:
                scen2 = simulate_recovery_lever(
                    schedule_activities=schedule_activities,
                    target_sched_id=sid,
                    recovery_type="PARALLEL_EXECUTION",
                    recovery_value=par_val,
                    baseline_cpm=baseline_cpm,
                    valid_deps=valid_deps,
                    schedule_filename=schedule_filename
                )
                scen2["milestone_impact"] = ms_info
                scenarios.append(scen2)
                total_scenarios_count += 1
                max_recoverable_days = max(max_recoverable_days, scen2.get("project_finish_recovery_days", 0))
            except Exception:
                pass

            # Lever 3: START_ADVANCEMENT
            adv_val = max(1, min(3, curr_dur // 4))
            try:
                scen3 = simulate_recovery_lever(
                    schedule_activities=schedule_activities,
                    target_sched_id=sid,
                    recovery_type="START_ADVANCEMENT",
                    recovery_value=adv_val,
                    baseline_cpm=baseline_cpm,
                    valid_deps=valid_deps,
                    schedule_filename=schedule_filename
                )
                scen3["milestone_impact"] = ms_info
                scenarios.append(scen3)
                total_scenarios_count += 1
                max_recoverable_days = max(max_recoverable_days, scen3.get("project_finish_recovery_days", 0))
            except Exception:
                pass

        plan_entry = {
            "activity_id": eid,
            "execution_activity_id": eid,
            "schedule_activity_id": sid,
            "activity_name": delay_act.get("execution_activity_name") or sched_act.get("activity_name") or eid,
            "discipline": sched_act.get("discipline") or delay_act.get("discipline") or "General",
            "level": sched_act.get("level") or "L6",
            "current_status": curr_status,
            "delay_severity": delay_sev,
            "delay_prediction_risk": pred_risk,
            "current_progress": curr_progress,
            "current_duration": curr_dur,
            "baseline_finish": base_finish,
            "critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
            "available_float": avail_float,
            "milestone": ms_info,
            "root_cause_category": rca_cat,
            "impact_summary": impact_summary,
            "recovery_priority": priority,
            "scenarios": scenarios
        }
        plans.append(plan_entry)

    # Sort plans: HIGH priority first, then MEDIUM, then LOW, then INSUFFICIENT_DATA
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INSUFFICIENT_DATA": 3}
    plans.sort(key=lambda x: (priority_order.get(x["recovery_priority"], 99), x["activity_id"]))

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "is_hypothetical": True,
        "in_memory_only": True,
        "baseline_schedule_modified": False,
        "database_modified": False,
        "disclaimer": "HYPOTHETICAL RECOVERY PLANS — BASELINE SCHEDULE REMAINS UNMODIFIED (READ-ONLY ANALYTICAL SCENARIOS)",
        "summary": {
            "total_eligible_activities": len(plans),
            "high_priority_count": priority_counts["HIGH"],
            "medium_priority_count": priority_counts["MEDIUM"],
            "low_priority_count": priority_counts["LOW"],
            "insufficient_data_count": priority_counts["INSUFFICIENT_DATA"],
            "total_scenarios_generated": total_scenarios_count,
            "max_project_recovery_days": max_recoverable_days
        },
        "recovery_plans": plans
    }
