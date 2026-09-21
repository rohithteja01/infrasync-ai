import copy
from datetime import date, timedelta
from collections import deque
from typing import Dict, Any, List, Set, Optional, Tuple

from app.services.matching import normalize_id
from app.services.critical_path import calculate_critical_path, parse_iso_date, parse_duration_days
from app.services.schedule_dependencies import get_schedule_dependencies
from app.services.schedule_health import get_schedule_health_results


ALLOWED_SCENARIO_TYPES = {"DELAY_DAYS", "DURATION_CHANGE", "COMPLETION_DATE_SHIFT"}
MAX_SCENARIO_VALUE = 365.0


def validate_what_if_inputs(
    activity_id: str,
    scenario_type: str,
    scenario_value: Any,
    schedule_activities: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Validates scenario inputs against baseline schedule activities.
    Rejects:
    - nonexistent activity (raises KeyError)
    - invalid scenario type (raises ValueError)
    - non-numeric, zero, negative, or unreasonable scenario values (raises ValueError)
    """
    if not activity_id or not str(activity_id).strip():
        raise KeyError("Activity ID must be specified.")

    norm_id = normalize_id(activity_id)

    # Check activity exists in baseline schedule
    matched_act = None
    for act in schedule_activities:
        if normalize_id(act.get("activity_id")) == norm_id:
            matched_act = act
            break

    if not matched_act:
        raise KeyError(f"Activity '{activity_id}' not found in baseline schedule.")

    # Check scenario type
    clean_type = str(scenario_type).strip().upper() if scenario_type else ""
    if clean_type not in ALLOWED_SCENARIO_TYPES:
        raise ValueError(
            f"Invalid scenario type '{scenario_type}'. Must be one of: {', '.join(sorted(ALLOWED_SCENARIO_TYPES))}."
        )

    # Check scenario value
    try:
        val = float(scenario_value)
    except (ValueError, TypeError):
        raise ValueError(f"Scenario value must be a valid number, got '{scenario_value}'.")

    if val <= 0:
        raise ValueError(f"Scenario value must be greater than 0, got {val}.")

    if val > MAX_SCENARIO_VALUE:
        raise ValueError(
            f"Scenario value of {val} days exceeds maximum permissible limit of {int(MAX_SCENARIO_VALUE)} days."
        )

    return {
        "activity": matched_act,
        "normalized_id": norm_id,
        "scenario_type": clean_type,
        "scenario_value": int(val) if val.is_integer() else round(val, 1)
    }


def simulate_what_if_scenario(
    schedule_activities: List[Dict[str, Any]],
    activity_id: str,
    scenario_type: str,
    scenario_value: Any,
    schedule_filename: str = "baseline_schedule.xlsx",
    execution_activities: Optional[List[Dict[str, Any]]] = None,
    execution_filename: str = "test_execution_matches.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.22: What-If Simulator Service.
    - Purely in-memory hypothetical scenario evaluation.
    - Never mutates baseline schedule file or database records.
    - Propagates hypothetical changes along Finish-to-Start baseline dependencies.
    - Recomputes CPM forward/backward passes on hypothetical schedule copy.
    - Compares baseline vs hypothetical project finish, floats, and critical paths.
    """
    # 1. Validate inputs
    valid_params = validate_what_if_inputs(
        activity_id=activity_id,
        scenario_type=scenario_type,
        scenario_value=scenario_value,
        schedule_activities=schedule_activities
    )
    target_norm_id = valid_params["normalized_id"]
    clean_type = valid_params["scenario_type"]
    clean_val = valid_params["scenario_value"]
    shift_days = int(round(clean_val))

    # 2. In-Memory Deep Copy of schedule activities (ensures baseline preservation)
    hypothetical_activities = copy.deepcopy(schedule_activities)

    # 3. Compute Baseline CPM (Feature 2.16)
    baseline_cpm = calculate_critical_path(schedule_activities, schedule_filename)
    baseline_cpm_by_id = {
        normalize_id(a.get("activity_id")): a for a in baseline_cpm.get("activities", [])
    }

    # 4. Fetch Milestone mapping (Feature 2.18)
    health_res = get_schedule_health_results(
        execution_activities=execution_activities or [],
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
            milestone_map[src_id] = {"milestone_id": ms_id, "milestone_name": ms_name}
        for supp in ms.get("supporting_activities", []):
            supp_id = normalize_id(supp.get("activity_id"))
            if supp_id:
                milestone_map[supp_id] = {"milestone_id": ms_id, "milestone_name": ms_name}

    # 5. Extract Baseline Dependencies (Feature 2.15)
    dep_res = get_schedule_dependencies(schedule_activities, schedule_filename)
    dependencies = dep_res.get("dependencies", [])

    succ_map: Dict[str, List[str]] = {}
    pred_map: Dict[str, List[str]] = {}
    lag_map: Dict[Tuple[str, str], int] = {}

    for d in dependencies:
        if d.get("validation_status") == "VALID":
            p_id = normalize_id(d.get("predecessor_activity_id"))
            s_id = normalize_id(d.get("successor_activity_id"))
            if p_id and s_id:
                if p_id not in succ_map:
                    succ_map[p_id] = []
                succ_map[p_id].append(s_id)

                if s_id not in pred_map:
                    pred_map[s_id] = []
                pred_map[s_id].append(p_id)

                # Compute baseline lag
                p_cpm = baseline_cpm_by_id.get(p_id)
                s_cpm = baseline_cpm_by_id.get(s_id)
                if p_cpm and s_cpm:
                    p_fin = parse_iso_date(p_cpm.get("planned_finish"))
                    s_str = parse_iso_date(s_cpm.get("planned_start"))
                    if p_fin and s_str:
                        lag_map[(p_id, s_id)] = (s_str - p_fin).days

    # 6. Apply Scenario Change to Target Activity in Hypothetical Copy
    hypo_act_map: Dict[str, Dict[str, Any]] = {}
    target_hypo_act = None
    for act in hypothetical_activities:
        nid = normalize_id(act.get("activity_id"))
        if nid:
            hypo_act_map[nid] = act
            if nid == target_norm_id:
                target_hypo_act = act

    target_base_start = parse_iso_date(target_hypo_act.get("planned_start"))
    target_base_finish = parse_iso_date(target_hypo_act.get("planned_finish"))
    target_base_dur = parse_duration_days(target_hypo_act.get("duration"))

    if clean_type == "DELAY_DAYS":
        target_hypo_start = target_base_start + timedelta(days=shift_days)
        target_hypo_dur = target_base_dur
        target_hypo_finish = target_base_finish + timedelta(days=shift_days)
    elif clean_type == "DURATION_CHANGE":
        target_hypo_start = target_base_start
        target_hypo_dur = target_base_dur + shift_days
        target_hypo_finish = target_base_finish + timedelta(days=shift_days)
    else:  # COMPLETION_DATE_SHIFT
        target_hypo_start = target_base_start
        target_hypo_dur = target_base_dur + shift_days
        target_hypo_finish = target_base_finish + timedelta(days=shift_days)

    target_hypo_act["planned_start"] = target_hypo_start.isoformat()
    target_hypo_act["planned_finish"] = target_hypo_finish.isoformat()
    target_hypo_act["duration"] = target_hypo_dur

    # 7. Propagate Downstream through Baseline Dependencies
    depth_map: Dict[str, int] = {target_norm_id: 0}
    queue: deque = deque([target_norm_id])
    visited: Set[str] = {target_norm_id}

    while queue:
        curr_id = queue.popleft()
        curr_hypo = hypo_act_map.get(curr_id)
        if not curr_hypo:
            continue
        curr_hypo_fin = parse_iso_date(curr_hypo.get("planned_finish"))

        for succ_id in succ_map.get(curr_id, []):
            succ_hypo = hypo_act_map.get(succ_id)
            if not succ_hypo:
                continue

            # Update propagation depth
            depth_map[succ_id] = max(depth_map.get(succ_id, 0), depth_map[curr_id] + 1)

            # Determine earliest possible start from all predecessors of succ_id
            succ_base_start = parse_iso_date(
                baseline_cpm_by_id.get(succ_id, {}).get("planned_start")
            ) or parse_iso_date(succ_hypo.get("planned_start"))

            req_starts = [succ_base_start]
            for p_id in pred_map.get(succ_id, []):
                p_hypo = hypo_act_map.get(p_id)
                if p_hypo:
                    p_fin = parse_iso_date(p_hypo.get("planned_finish"))
                    if p_fin:
                        lag = lag_map.get((p_id, succ_id), 0)
                        req_starts.append(p_fin + timedelta(days=lag))

            new_start = max(req_starts)
            succ_dur = parse_duration_days(succ_hypo.get("duration"))
            new_finish = new_start + timedelta(days=succ_dur)

            # Update hypothetical dates for successor
            succ_hypo["planned_start"] = new_start.isoformat()
            succ_hypo["planned_finish"] = new_finish.isoformat()

            if succ_id not in visited:
                visited.add(succ_id)
                queue.append(succ_id)

    # 8. Recompute CPM on Hypothetical Schedule Copy
    hypothetical_cpm = calculate_critical_path(hypothetical_activities, schedule_filename)
    hypo_cpm_by_id = {
        normalize_id(a.get("activity_id")): a for a in hypothetical_cpm.get("activities", [])
    }

    # 9. Compare Baseline vs Hypothetical
    base_summary = baseline_cpm.get("summary", {})
    hypo_summary = hypothetical_cpm.get("summary", {})

    base_proj_fin = parse_iso_date(base_summary.get("project_finish"))
    hypo_proj_fin = parse_iso_date(hypo_summary.get("project_finish"))
    project_finish_shift_days = (hypo_proj_fin - base_proj_fin).days if (base_proj_fin and hypo_proj_fin) else 0

    duration_change_days = (
        hypo_summary.get("project_duration_days", 0) - base_summary.get("project_duration_days", 0)
    )

    base_crit_set = {
        a["activity_id"] for a in baseline_cpm.get("activities", []) if a.get("is_critical")
    }
    hypo_crit_set = {
        a["activity_id"] for a in hypothetical_cpm.get("activities", []) if a.get("is_critical")
    }

    critical_path_changed = (base_crit_set != hypo_crit_set)
    newly_critical = sorted(list(hypo_crit_set - base_crit_set))
    no_longer_critical = sorted(list(base_crit_set - hypo_crit_set))

    # 10. Assemble Detailed Activity Records
    activity_comparison_list: List[Dict[str, Any]] = []
    propagation_chain: List[Dict[str, Any]] = []
    affected_milestone_dict: Dict[str, Dict[str, Any]] = {}
    direct_impact_count = 0
    indirect_impact_count = 0

    for act in schedule_activities:
        aid = act.get("activity_id") or ""
        nid = normalize_id(aid)
        aname = act.get("activity_name") or aid
        level = act.get("level") or "L6"
        disc = act.get("discipline") or "General"

        b_cpm = baseline_cpm_by_id.get(nid, {})
        h_cpm = hypo_cpm_by_id.get(nid, {})

        b_start = b_cpm.get("planned_start") or str(act.get("planned_start"))
        b_finish = b_cpm.get("planned_finish") or str(act.get("planned_finish"))
        b_dur = b_cpm.get("duration_days") or parse_duration_days(act.get("duration"))
        b_float = b_cpm.get("total_float")
        b_crit = bool(b_cpm.get("is_critical", False))

        h_act = hypo_act_map.get(nid, {})
        h_start = str(h_act.get("planned_start"))
        h_finish = str(h_act.get("planned_finish"))
        h_dur = parse_duration_days(h_act.get("duration"))
        h_float = h_cpm.get("total_float")
        h_crit = bool(h_cpm.get("is_critical", False))

        # Date shift calculations
        d_b_start = parse_iso_date(b_start)
        d_h_start = parse_iso_date(h_start)
        d_b_fin = parse_iso_date(b_finish)
        d_h_fin = parse_iso_date(h_finish)

        start_shift = (d_h_start - d_b_start).days if (d_h_start and d_b_start) else 0
        finish_shift = (d_h_fin - d_b_fin).days if (d_h_fin and d_b_fin) else 0
        float_change = (h_float - b_float) if (h_float is not None and b_float is not None) else None

        is_target = (nid == target_norm_id)
        depth = depth_map.get(nid)
        is_affected = is_target or (finish_shift > 0) or (start_shift > 0)

        if is_target:
            impact_type = "SOURCE_ACTIVITY"
            role = "SOURCE"
        elif depth == 1:
            impact_type = "DIRECT_SUCCESSOR"
            role = "DOWNSTREAM"
            if is_affected:
                direct_impact_count += 1
        elif depth is not None and depth > 1:
            impact_type = "INDIRECT_SUCCESSOR"
            role = "DOWNSTREAM"
            if is_affected:
                indirect_impact_count += 1
        else:
            impact_type = "UNAFFECTED"
            role = "UNAFFECTED"

        ms_info = milestone_map.get(nid, {})
        ms_id = ms_info.get("milestone_id")
        ms_name = ms_info.get("milestone_name")

        if is_affected and ms_id:
            if ms_id not in affected_milestone_dict:
                affected_milestone_dict[ms_id] = {
                    "milestone_id": ms_id,
                    "milestone_name": ms_name,
                    "affected_activities": []
                }
            affected_milestone_dict[ms_id]["affected_activities"].append(aid)

        record = {
            "activity_id": aid,
            "activity_name": aname,
            "level": level,
            "discipline": disc,
            "baseline_start": b_start,
            "baseline_finish": b_finish,
            "baseline_duration": b_dur,
            "baseline_float": b_float,
            "baseline_critical": b_crit,
            "hypothetical_start": h_start,
            "hypothetical_finish": h_finish,
            "hypothetical_duration": h_dur,
            "hypothetical_float": h_float,
            "hypothetical_critical": h_crit,
            "start_shift_days": start_shift,
            "finish_shift_days": finish_shift,
            "float_change_days": float_change,
            "is_affected": is_affected,
            "propagation_depth": depth,
            "impact_type": impact_type,
            "role": role,
            "milestone_id": ms_id,
            "milestone_name": ms_name
        }

        activity_comparison_list.append(record)
        if is_affected:
            propagation_chain.append(record)

    # Sort propagation chain by depth, then hypothetical start
    propagation_chain.sort(key=lambda x: (x["propagation_depth"] if x["propagation_depth"] is not None else 999, x["hypothetical_start"]))

    total_affected_count = len(propagation_chain)

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "is_hypothetical": True,
        "in_memory_only": True,
        "baseline_schedule_modified": False,
        "database_modified": False,
        "disclaimer": "HYPOTHETICAL SCENARIO — BASELINE SCHEDULE REMAINS UNMODIFIED",
        "scenario": {
            "activity_id": target_hypo_act.get("activity_id") or activity_id,
            "activity_name": target_hypo_act.get("activity_name") or activity_id,
            "scenario_type": clean_type,
            "scenario_value": clean_val,
            "unit": "days",
            "description": f"Hypothetical {clean_type.replace('_', ' ').lower()} of +{clean_val} days on {activity_id}."
        },
        "baseline": {
            "project_start": base_summary.get("project_start"),
            "project_finish": base_summary.get("project_finish"),
            "project_duration_days": base_summary.get("project_duration_days"),
            "critical_activity_count": base_summary.get("critical_activities"),
            "non_critical_activity_count": base_summary.get("non_critical_activities"),
            "critical_paths_count": base_summary.get("critical_paths_count")
        },
        "hypothetical": {
            "project_start": hypo_summary.get("project_start"),
            "project_finish": hypo_summary.get("project_finish"),
            "project_duration_days": hypo_summary.get("project_duration_days"),
            "critical_activity_count": hypo_summary.get("critical_activities"),
            "non_critical_activity_count": hypo_summary.get("non_critical_activities"),
            "critical_paths_count": hypo_summary.get("critical_paths_count")
        },
        "comparison": {
            "project_finish_shift_days": project_finish_shift_days,
            "duration_change_days": duration_change_days,
            "critical_path_changed": critical_path_changed,
            "newly_critical_activities": newly_critical,
            "no_longer_critical_activities": no_longer_critical,
            "total_affected_activities": total_affected_count,
            "direct_impact_count": direct_impact_count,
            "indirect_impact_count": indirect_impact_count
        },
        "affected_milestones": list(affected_milestone_dict.values()),
        "propagation_chain": propagation_chain,
        "activities": activity_comparison_list
    }
