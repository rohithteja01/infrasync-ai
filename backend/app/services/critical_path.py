import re
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from app.services.matching import normalize_id
from app.services.schedule_dependencies import get_schedule_dependencies


def parse_iso_date(val: Any) -> Optional[date]:
    """Parses various date representations into a standard date object."""
    if not val or val == "-":
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


def parse_duration_days(val: Any, default: int = 1) -> int:
    """Extracts numeric duration in days from string or number."""
    if val is None or val == "-":
        return default
    if isinstance(val, (int, float)):
        return max(1, int(val))
    match = re.search(r'\d+', str(val))
    if match:
        return max(1, int(match.group(0)))
    return default


def calculate_critical_path(
    schedule_activities: List[Dict[str, Any]],
    schedule_filename: str = "baseline_schedule.xlsx"
) -> Dict[str, Any]:
    """
    Feature 2.16: Critical Path Method (CPM) Analysis.
    Deterministic forward pass, backward pass, float calculations, and critical path identification.
    Strictly read-only and analytical (no database writes or schedule mutations).
    """
    if not schedule_activities:
        return {
            "schedule_file": schedule_filename,
            "analysis_status": "EMPTY_SCHEDULE",
            "error_message": "No schedule activities provided for critical path analysis.",
            "summary": {
                "total_activities": 0,
                "critical_activities": 0,
                "non_critical_activities": 0,
                "critical_paths_count": 0,
                "project_start": "-",
                "project_finish": "-",
                "project_duration_days": 0,
                "total_dependencies": 0,
                "valid_dependencies": 0
            },
            "critical_paths": [],
            "activities": []
        }

    # 1. Normalize and index activities
    act_map: Dict[str, Dict[str, Any]] = {}
    for act in schedule_activities:
        aid = act.get("activity_id") or ""
        norm_id = normalize_id(aid)
        if not norm_id:
            continue

        s_date = parse_iso_date(act.get("planned_start"))
        f_date = parse_iso_date(act.get("planned_finish"))
        dur = parse_duration_days(act.get("duration"))
        
        # Fallback if duration is missing but dates exist
        if s_date and f_date and f_date >= s_date:
            calc_dur = (f_date - s_date).days
            if calc_dur > 0 and dur == 1 and act.get("duration") in (None, "-", ""):
                dur = calc_dur

        act_map[norm_id] = {
            "id": aid,
            "norm_id": norm_id,
            "name": act.get("activity_name") or "Unnamed Activity",
            "level": act.get("level") or "L6",
            "wbs": act.get("wbs") or "-",
            "discipline": act.get("discipline") or "General",
            "start": s_date,
            "finish": f_date,
            "duration": dur,
            "raw_record": act
        }

    # 2. Extract valid Finish-to-Start dependencies using Feature 2.15 service
    dep_res = get_schedule_dependencies(schedule_activities, schedule_filename)
    all_deps = dep_res.get("dependencies", [])
    valid_deps = [d for d in all_deps if d.get("validation_status") == "VALID"]

    # Graph adjacency structures
    preds: Dict[str, List[str]] = {nid: [] for nid in act_map}
    succs: Dict[str, List[str]] = {nid: [] for nid in act_map}
    link_lags: Dict[tuple, int] = {}

    for d in valid_deps:
        p_norm = normalize_id(d.get("predecessor_activity_id"))
        s_norm = normalize_id(d.get("successor_activity_id"))
        if p_norm in act_map and s_norm in act_map and p_norm != s_norm:
            preds[s_norm].append(p_norm)
            succs[p_norm].append(s_norm)
            # Finish-to-Start link lag in baseline schedule
            p_act = act_map[p_norm]
            s_act = act_map[s_norm]
            if p_act["finish"] and s_act["start"]:
                lag = (s_act["start"] - p_act["finish"]).days
            else:
                lag = 0
            link_lags[(p_norm, s_norm)] = lag

    # 3. Cycle detection and topological sort (Kahn's Algorithm)
    in_degree = {nid: len(preds[nid]) for nid in act_map}
    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    topo_order = []

    while queue:
        curr = queue.pop(0)
        topo_order.append(curr)
        for s in succs[curr]:
            in_degree[s] -= 1
            if in_degree[s] == 0:
                queue.append(s)

    if len(topo_order) < len(act_map):
        # Graph contains a cycle
        cyclic_nodes = [act_map[nid]["id"] for nid, deg in in_degree.items() if deg > 0]
        return {
            "schedule_file": schedule_filename,
            "analysis_status": "CIRCULAR_DEPENDENCY_DETECTED",
            "error_message": f"Circular dependency detected involving activities: {', '.join(cyclic_nodes)}",
            "summary": {
                "total_activities": len(act_map),
                "critical_activities": 0,
                "non_critical_activities": len(act_map),
                "critical_paths_count": 0,
                "project_start": "-",
                "project_finish": "-",
                "project_duration_days": 0,
                "total_dependencies": len(all_deps),
                "valid_dependencies": len(valid_deps)
            },
            "critical_paths": [],
            "activities": []
        }

    # 4. Determine overall project boundaries
    valid_starts = [a["start"] for a in act_map.values() if a["start"]]
    valid_finishes = [a["finish"] for a in act_map.values() if a["finish"]]
    proj_start = min(valid_starts) if valid_starts else date.today()
    proj_finish = max(valid_finishes) if valid_finishes else proj_start
    project_duration_days = (proj_finish - proj_start).days

    # 5. Forward Pass: Early Start (ES) and Early Finish (EF)
    es: Dict[str, date] = {}
    ef: Dict[str, date] = {}

    for nid in topo_order:
        act = act_map[nid]
        if not preds[nid]:
            es[nid] = act["start"] or proj_start
        else:
            cand_starts = [
                ef[p] + timedelta(days=link_lags.get((p, nid), 0))
                for p in preds[nid]
            ]
            es[nid] = max(cand_starts)
        ef[nid] = es[nid] + timedelta(days=act["duration"])

    # 6. Backward Pass: Late Finish (LF) and Late Start (LS)
    lf: Dict[str, date] = {}
    ls: Dict[str, date] = {}

    for nid in reversed(topo_order):
        act = act_map[nid]
        if not succs[nid]:
            lf[nid] = proj_finish
        else:
            cand_finishes = [
                ls[s] - timedelta(days=link_lags.get((nid, s), 0))
                for s in succs[nid]
            ]
            lf[nid] = min(cand_finishes)
        ls[nid] = lf[nid] - timedelta(days=act["duration"])

    # 7. Float Calculation & Criticality Classification
    total_float: Dict[str, int] = {}
    free_float: Dict[str, int] = {}
    is_critical: Dict[str, bool] = {}

    for nid in act_map:
        tf = (ls[nid] - es[nid]).days
        total_float[nid] = max(0, tf)
        is_critical[nid] = (tf == 0)

        # Free float: delay permitted without affecting Early Start of any successor
        if not succs[nid]:
            ff = (proj_finish - ef[nid]).days
        else:
            ff_cands = [
                (es[s] - timedelta(days=link_lags.get((nid, s), 0)) - ef[nid]).days
                for s in succs[nid]
            ]
            ff = min(ff_cands) if ff_cands else 0
        free_float[nid] = max(0, ff)

    # 8. Identify Critical Paths
    crit_roots = [
        nid for nid in topo_order
        if is_critical[nid] and not any(is_critical[p] for p in preds[nid])
    ]

    def trace_critical_paths(current_nid: str, current_path: List[str]) -> List[List[str]]:
        crit_succs = [s for s in succs[current_nid] if is_critical[s]]
        if not crit_succs:
            return [current_path]
        paths = []
        for s in crit_succs:
            paths.extend(trace_critical_paths(s, current_path + [s]))
        return paths

    raw_crit_paths = []
    for root in crit_roots:
        raw_crit_paths.extend(trace_critical_paths(root, [root]))

    # Filter out duplicate paths formed purely by L5 summary activities
    # Executable activities represent the genuine project critical path
    executable_crit_paths = [
        p for p in raw_crit_paths
        if not all(act_map[nid]["level"] == "L5" for nid in p)
    ]
    crit_paths_to_report = executable_crit_paths if executable_crit_paths else raw_crit_paths

    critical_paths_list: List[Dict[str, Any]] = []
    for idx, path_nids in enumerate(crit_paths_to_report, 1):
        path_acts = [act_map[nid] for nid in path_nids]
        levels = set(a["level"] for a in path_acts)
        level_label = list(levels)[0] if len(levels) == 1 else "Multi-Level"
        
        # Path title descriptor
        if level_label == "L5":
            desc = "L5 Milestone / Summary Chain"
        elif level_label == "L6":
            desc = "L6 Detailed Execution Chain"
        else:
            desc = f"{level_label} Integrated Chain"

        p_start = es[path_nids[0]]
        p_finish = ef[path_nids[-1]]
        span_days = (p_finish - p_start).days
        total_work_days = sum(a["duration"] for a in path_acts)

        critical_paths_list.append({
            "path_id": f"CP-{idx:02d}",
            "path_name": f"Critical Path {idx} ({desc})",
            "level": level_label,
            "activity_count": len(path_acts),
            "sequence": [a["id"] for a in path_acts],
            "sequence_display": " → ".join(a["id"] for a in path_acts),
            "start_date": p_start.isoformat(),
            "finish_date": p_finish.isoformat(),
            "calendar_span_days": span_days,
            "total_work_days": total_work_days,
            "activities": [
                {
                    "activity_id": a["id"],
                    "activity_name": a["name"],
                    "level": a["level"],
                    "wbs": a["wbs"],
                    "duration_days": a["duration"],
                    "early_start": es[a["norm_id"]].isoformat(),
                    "early_finish": ef[a["norm_id"]].isoformat()
                }
                for a in path_acts
            ]
        })

    # 9. Format Full Activity Records
    activity_records: List[Dict[str, Any]] = []
    critical_count = sum(1 for c in is_critical.values() if c)
    non_critical_count = len(act_map) - critical_count

    # Sort activities chronologically by early start, then level (L5 then L6), then ID
    sorted_nids = sorted(
        act_map.keys(),
        key=lambda k: (es[k], 0 if act_map[k]["level"] == "L5" else 1, act_map[k]["id"])
    )

    for idx, nid in enumerate(sorted_nids, 1):
        a = act_map[nid]
        crit = is_critical[nid]
        tf_days = total_float[nid]
        ff_days = free_float[nid]

        if crit:
            crit_reason = "Zero total float (0 days). Any delay directly extends the overall project completion date."
        else:
            crit_reason = f"{tf_days} days total float buffer available before impacting project completion date."

        pred_display = [act_map[p]["id"] for p in preds[nid]]
        succ_display = [act_map[s]["id"] for s in succs[nid]]

        activity_records.append({
            "index": idx,
            "activity_id": a["id"],
            "activity_name": a["name"],
            "level": a["level"],
            "is_summary": a["level"] == "L5",
            "wbs": a["wbs"],
            "discipline": a["discipline"],
            "duration_days": a["duration"],
            "duration_display": f"{a['duration']} days" if a["duration"] != 1 else "1 day",
            "planned_start": a["start"].isoformat() if a["start"] else "-",
            "planned_finish": a["finish"].isoformat() if a["finish"] else "-",
            "early_start": es[nid].isoformat(),
            "early_finish": ef[nid].isoformat(),
            "late_start": ls[nid].isoformat(),
            "late_finish": lf[nid].isoformat(),
            "total_float": tf_days,
            "free_float": ff_days,
            "is_critical": crit,
            "critical_status": "CRITICAL" if crit else "NON_CRITICAL",
            "criticality_reason": crit_reason,
            "predecessors": pred_display,
            "successors": succ_display,
            "predecessors_display": ", ".join(pred_display) if pred_display else "None (Start Node)",
            "successors_display": ", ".join(succ_display) if succ_display else "None (Terminal Node)"
        })

    return {
        "schedule_file": schedule_filename,
        "analysis_status": "VALID",
        "method": "CRITICAL_PATH_METHOD_CPM",
        "summary": {
            "total_activities": len(act_map),
            "critical_activities": critical_count,
            "non_critical_activities": non_critical_count,
            "critical_paths_count": len(critical_paths_list),
            "project_start": proj_start.isoformat(),
            "project_finish": proj_finish.isoformat(),
            "project_duration_days": project_duration_days,
            "project_duration_display": f"{project_duration_days} days",
            "total_dependencies": len(all_deps),
            "valid_dependencies": len(valid_deps)
        },
        "critical_paths": critical_paths_list,
        "activities": activity_records
    }
