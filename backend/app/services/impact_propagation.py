from typing import Dict, Any, List, Set, Optional
from collections import deque
from app.services.matching import normalize_id
from app.services.delay_detection import get_delay_detection_results
from app.services.critical_path import calculate_critical_path
from app.services.schedule_dependencies import get_schedule_dependencies
from app.services.schedule_health import get_schedule_health_results
from app.services.delay_prediction import get_delay_prediction_results
from app.services.root_cause_analysis import get_root_cause_analysis_results


def propagate_activity_impact(
    source_act: Dict[str, Any],
    pred_info: Dict[str, Any],
    rca_info: Dict[str, Any],
    succ_map: Dict[str, List[Dict[str, Any]]],
    cpm_activity_map: Dict[str, Dict[str, Any]],
    milestone_map: Dict[str, Dict[str, Any]],
    completion_path_ids: Set[str]
) -> Dict[str, Any]:
    """
    Feature 2.21: Traverses the downstream dependency graph from a single
    delayed or at-risk source activity using Breadth-First Search (BFS).

    Determines:
    - Direct successors (depth = 1, DIRECT_SUCCESSOR)
    - Indirect successors (depth > 1, INDIRECT_SUCCESSOR)
    - Critical path exposure (Feature 2.16 CPM)
    - Milestone exposure (Feature 2.18 Milestones)
    - Project duration exposure (reaches project completion critical path)
    - Impact status classification
    """
    eid = source_act.get("execution_activity_id") or ""
    ename = source_act.get("execution_activity_name") or ""
    sid = source_act.get("schedule_activity_id") or ""
    level = source_act.get("schedule_level") or "L6"
    discipline = source_act.get("discipline") or "General"
    current_status = source_act.get("status") or "INSUFFICIENT_DATA"
    severity = source_act.get("severity") or "NO_DELAY"
    is_critical = bool(source_act.get("critical", False))
    total_float = source_act.get("total_float")

    norm_sid = normalize_id(sid)

    # BFS Traversal with cycle protection
    visited: Set[str] = {norm_sid}
    queue: deque = deque([(norm_sid, 0)])  # (normalized_schedule_id, depth)

    affected_activities: List[Dict[str, Any]] = []
    affected_milestone_ids: Set[str] = set()
    affected_critical_activities: List[str] = []
    direct_count = 0
    indirect_count = 0
    max_depth = 0

    while queue:
        curr_norm_id, curr_depth = queue.popleft()

        # Get valid downstream successors from dependency graph
        for succ_dep in succ_map.get(curr_norm_id, []):
            succ_id = succ_dep.get("successor_activity_id") or ""
            norm_succ_id = normalize_id(succ_id)

            if norm_succ_id not in visited:
                visited.add(norm_succ_id)
                next_depth = curr_depth + 1
                max_depth = max(max_depth, next_depth)

                if next_depth == 1:
                    direct_count += 1
                    impact_type = "DIRECT_SUCCESSOR"
                else:
                    indirect_count += 1
                    impact_type = "INDIRECT_SUCCESSOR"

                # Correlate CPM details
                cpm_info = cpm_activity_map.get(norm_succ_id, {})
                succ_name = cpm_info.get("activity_name") or succ_dep.get("successor_activity_name") or succ_id
                succ_level = cpm_info.get("level") or succ_dep.get("successor_level") or "L6"
                succ_is_critical = bool(cpm_info.get("is_critical", False))
                succ_float = cpm_info.get("total_float")
                crit_status = "CRITICAL" if succ_is_critical else "NON_CRITICAL"

                if succ_is_critical:
                    affected_critical_activities.append(succ_id)

                # Correlate Milestone details
                ms_info = milestone_map.get(norm_succ_id, {})
                ms_id = ms_info.get("milestone_id")
                ms_name = ms_info.get("milestone_name") or ms_id
                if ms_id:
                    affected_milestone_ids.add(ms_id)

                # Check if activity lies on project-completion critical path
                on_completion_path = (norm_succ_id in completion_path_ids)

                # Factual, verifiable evidence citations
                evidence_list: List[str] = [
                    f"Baseline Dependency: Downstream connection from {curr_norm_id} to {succ_id} "
                    f"(Finish-to-Start relationship, propagation depth {next_depth})."
                ]

                if succ_is_critical:
                    evidence_list.append(
                        f"Critical Path Impact: Activity drives the project critical path with zero total float (0 days); "
                        f"any delay propagated from upstream directly threatens completion."
                    )
                elif succ_float is not None:
                    evidence_list.append(
                        f"Float Buffer: Activity has {succ_float} days total float buffer before impacting the project baseline."
                    )

                if ms_id:
                    evidence_list.append(
                        f"Milestone Exposure: Activity directly supports parent milestone {ms_id} ({ms_name})."
                    )

                if on_completion_path:
                    evidence_list.append(
                        f"Project Duration Exposure: Activity lies on the project-defining critical path driving final completion."
                    )

                affected_activities.append({
                    "activity_id": succ_id,
                    "activity_name": succ_name,
                    "schedule_level": succ_level,
                    "depth": next_depth,
                    "impact_type": impact_type,
                    "critical_path_status": crit_status,
                    "total_float": succ_float,
                    "milestone_id": ms_id,
                    "milestone_name": ms_name,
                    "is_on_critical_path": succ_is_critical,
                    "is_on_completion_path": on_completion_path,
                    "evidence": evidence_list
                })

                queue.append((norm_succ_id, next_depth))

    # Evaluate Overall Impact Status Hierarchy
    has_crit_impact = len(affected_critical_activities) > 0
    has_ms_impact = len(affected_milestone_ids) > 0
    has_proj_duration_exposure = any(
        a["is_on_completion_path"] and a["is_on_critical_path"] for a in affected_activities
    )

    if has_proj_duration_exposure:
        impact_status = "PROJECT_DURATION_EXPOSURE"
    elif has_ms_impact:
        impact_status = "MILESTONE_IMPACT"
    elif has_crit_impact:
        impact_status = "CRITICAL_PATH_IMPACT"
    elif len(affected_activities) > 0:
        impact_status = "DOWNSTREAM_IMPACT"
    else:
        impact_status = "NO_DOWNSTREAM_IMPACT"

    return {
        "source_activity_id": eid,
        "source_activity_name": ename,
        "source_schedule_activity_id": sid,
        "source_schedule_level": level,
        "source_discipline": discipline,
        "source_delay_status": current_status,
        "source_delay_severity": severity,
        "source_prediction_risk": pred_info.get("predicted_delay_risk") or "UNKNOWN",
        "source_prediction_score": pred_info.get("prediction_score"),
        "source_total_float": total_float,
        "source_critical_path_status": "CRITICAL" if is_critical else "NON_CRITICAL",
        "source_root_cause_category": rca_info.get("root_cause_category") or "UNKNOWN",
        "source_root_cause_confidence": rca_info.get("root_cause_confidence"),

        "direct_successor_count": direct_count,
        "indirect_successor_count": indirect_count,
        "total_affected_activities": len(affected_activities),

        "affected_activities": affected_activities,
        "affected_activity_ids": [a["activity_id"] for a in affected_activities],
        "affected_milestone_ids": sorted(list(affected_milestone_ids)),
        "affected_critical_activities": affected_critical_activities,
        "maximum_propagation_depth": max_depth,
        "critical_path_impact": has_crit_impact,
        "milestone_impact": has_ms_impact,
        "project_duration_exposure": has_proj_duration_exposure,
        "impact_status": impact_status
    }


def get_impact_propagation_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "test_execution_matches.xlsx",
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.21: Impact Propagation Service.
    - Evaluates delayed or high/medium risk activities from existing pipeline layers.
    - Traverses baseline Finish-to-Start dependency network.
    - Identifies direct vs indirect successor impact and maximum propagation depth.
    - Determines critical path, milestone, and project duration exposures.
    - Strictly read-only and analytical (zero database mutations, zero schedule modifications).
    """
    # 1. Retrieve Schedule Dependencies (Feature 2.15)
    dep_res = get_schedule_dependencies(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    dependencies = dep_res.get("dependencies", [])

    # Build adjacency list: predecessor -> list of successor dependencies
    succ_map: Dict[str, List[Dict[str, Any]]] = {}
    for d in dependencies:
        if d.get("validation_status") == "VALID":
            p_id = normalize_id(d.get("predecessor_activity_id"))
            if p_id:
                if p_id not in succ_map:
                    succ_map[p_id] = []
                succ_map[p_id].append(d)

    # 2. Retrieve Critical Path Analysis (Feature 2.16)
    cpm_res = calculate_critical_path(
        schedule_activities=schedule_activities,
        schedule_filename=schedule_filename
    )
    cpm_activities = cpm_res.get("activities", [])
    cpm_activity_map: Dict[str, Dict[str, Any]] = {
        normalize_id(a.get("activity_id")): a for a in cpm_activities
    }

    # Identify activities on project completion critical paths
    # (critical activities in critical paths that terminate at the project finish date)
    completion_path_ids: Set[str] = set()
    for cp in cpm_res.get("critical_paths", []):
        for act_id in cp.get("sequence", []):
            completion_path_ids.add(normalize_id(act_id))

    # 3. Retrieve Schedule Health & Milestone hierarchy (Feature 2.18)
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

    # 5. Retrieve Root Cause Analysis results (Feature 2.20)
    rca_res = get_root_cause_analysis_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    rca_map = {r.get("activity_id"): r for r in rca_res.get("activities", [])}

    # 6. Retrieve Delay Detection results (Feature 2.17) to filter eligible sources
    delay_res = get_delay_detection_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    delay_activities = delay_res.get("activities", [])

    # Filter to eligible delayed or at-risk activities
    propagation_records: List[Dict[str, Any]] = []
    all_affected_activity_ids: Set[str] = set()

    for act in delay_activities:
        eid = act.get("execution_activity_id") or ""
        pred_info = pred_map.get(eid, {})
        rca_info = rca_map.get(eid, {})

        is_behind = (act.get("status") == "BEHIND")
        is_at_risk = (
            pred_info.get("predicted_delay_risk") in ("HIGH", "MEDIUM") or
            pred_info.get("prediction_status") in ("HIGH_RISK", "MEDIUM_RISK")
        )

        # Skip on-plan or completed activities
        if not (is_behind or is_at_risk):
            continue

        result = propagate_activity_impact(
            source_act=act,
            pred_info=pred_info,
            rca_info=rca_info,
            succ_map=succ_map,
            cpm_activity_map=cpm_activity_map,
            milestone_map=milestone_map,
            completion_path_ids=completion_path_ids
        )

        for aff_id in result["affected_activity_ids"]:
            all_affected_activity_ids.add(aff_id)

        propagation_records.append(result)

    summary = {
        "total_sources": len(propagation_records),
        "total_affected_activities": len(all_affected_activity_ids),
        "direct_impacts": sum(r["direct_successor_count"] for r in propagation_records),
        "indirect_impacts": sum(r["indirect_successor_count"] for r in propagation_records),
        "critical_path_impacts": sum(1 for r in propagation_records if r["critical_path_impact"]),
        "milestone_impacts": sum(1 for r in propagation_records if r["milestone_impact"]),
        "project_duration_exposures": sum(1 for r in propagation_records if r["project_duration_exposure"])
    }

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "summary": summary,
        "propagation": propagation_records
    }
