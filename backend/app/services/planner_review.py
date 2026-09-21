from typing import Dict, Any, List, Optional
from app.services.matching import calculate_validation_results, normalize_id


def determine_review_priority(discovery_status: str, candidate_tier: str) -> str:
    """
    Feature 2.13: Deterministic Review Priority rules.
    HIGH:
    - NEW_ACTIVITY_CANDIDATE
    - UNKNOWN (or candidate_tier == 'NONE')
    MEDIUM:
    - FUZZY or SEMANTIC below the auto-accept threshold
    """
    d_status = (discovery_status or "").upper().strip()
    tier = (candidate_tier or "").upper().strip()

    if d_status in ("NEW_ACTIVITY_CANDIDATE", "UNKNOWN") or tier in ("NONE", ""):
        return "HIGH"

    if tier in ("FUZZY", "SEMANTIC"):
        return "MEDIUM"

    return "MEDIUM"


def generate_review_reason(discovery_status: str, candidate_tier: str, confidence_percentage: int) -> str:
    """
    Feature 2.13: Transparent deterministic review reason generation.
    No LLM used.
    """
    d_status = (discovery_status or "").upper().strip()
    tier = (candidate_tier or "").upper().strip()

    if d_status == "NEW_ACTIVITY_CANDIDATE":
        return "Activity was not matched to the baseline schedule and was classified as a new activity candidate."

    if d_status == "UNKNOWN" or tier in ("NONE", ""):
        return "Activity could not be safely matched or classified and requires planner review."

    if tier == "SEMANTIC":
        return f"Semantic candidate requires planner review because confidence ({confidence_percentage}%) is below the 90% auto-accept threshold."

    if tier == "FUZZY":
        return f"Fuzzy candidate requires planner review because confidence ({confidence_percentage}%) is below the 90% auto-accept threshold."

    return "Validation confidence is below auto-accept threshold; requires planner review."


def build_evidence_summary(record: Dict[str, Any], matched_level: Optional[str] = None) -> Dict[str, Any]:
    """
    Feature 2.13: Generates structured evidence summary explaining what the planner should inspect.
    """
    d_status = (record.get("discovery_status") or "").upper().strip()
    tier = (record.get("candidate_tier") or "").upper().strip()

    exec_id = record.get("execution_activity_id")
    exec_name = record.get("execution_activity_name")
    discipline = record.get("discipline") or "General"
    exec_wbs = record.get("execution_wbs") or "-"
    sched_id = record.get("matched_schedule_activity_id")
    sched_name = record.get("matched_schedule_activity_name")
    granularity = record.get("granularity_status") or "UNKNOWN"
    conf_pct = record.get("confidence_percentage", 0)

    if tier in ("SEMANTIC", "FUZZY"):
        return {
            "type": "matched_candidate_review",
            "best_match_tier": tier,
            "discovery_classification": d_status,
            "candidate_schedule_id": sched_id,
            "candidate_schedule_name": sched_name,
            "execution_activity": f"{exec_id} - {exec_name}",
            "candidate_schedule_activity": f"{sched_id} - {sched_name}",
            "schedule_level": matched_level or "L6",
            "confidence": f"{conf_pct}%",
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "granularity_status": granularity,
            "inspection_note": "Planner should verify whether the field execution work description corresponds to the suggested schedule task."
        }

    if d_status == "NEW_ACTIVITY_CANDIDATE":
        return {
            "type": "new_activity_proposal",
            "best_match_tier": tier,
            "discovery_classification": d_status,
            "candidate_schedule_id": None,
            "candidate_schedule_name": None,
            "execution_activity": f"{exec_id} - {exec_name}",
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "descriptive_evidence": record.get("confidence_basis") or "Verified activity name and work description in field execution records.",
            "baseline_status": "No corresponding L5 or L6 activity found in baseline schedule.",
            "inspection_note": "Planner should review field execution records to determine whether this scope should be proposed as a formal schedule change."
        }

    return {
        "type": "unresolved_activity",
        "best_match_tier": tier,
        "discovery_classification": d_status,
        "candidate_schedule_id": None,
        "candidate_schedule_name": None,
        "execution_activity": f"{exec_id} - {exec_name}",
        "discipline": discipline,
        "execution_wbs": exec_wbs,
        "baseline_status": "Unresolved across all matching algorithms with insufficient descriptive evidence.",
        "inspection_note": "Planner should verify the source document and check if activity name or description is missing."
    }


def get_planner_review_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.13: Dedicated Planner Review & Validation Governance service.
    Consumes Feature 2.12 validation output directly.
    Filters strictly for records with validation_status == 'PLANNER_REVIEW'.
    Does NOT modify schedule, auto-create activities, or write to database.
    """
    # Ingest upstream Feature 2.12 validation results directly
    validation_output = calculate_validation_results(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename,
        auto_accept_threshold=0.90
    )

    # Index schedule activities to look up schedule level
    sched_level_lookup: Dict[str, str] = {}
    for s in schedule_activities:
        sid = normalize_id(s.get("activity_id"))
        if sid:
            sched_level_lookup[sid] = str(s.get("level") or "").upper().strip()

    all_results = validation_output.get("results", [])
    review_records: List[Dict[str, Any]] = []
    high_count = 0
    medium_count = 0

    for item in all_results:
        # Strictly filter for PLANNER_REVIEW records only
        if item.get("validation_status") != "PLANNER_REVIEW":
            continue

        d_status = item.get("discovery_status") or "UNKNOWN"
        c_tier = item.get("candidate_tier") or "NONE"
        conf_pct = item.get("confidence_percentage", 0)

        # Determine review priority and reason
        priority = determine_review_priority(discovery_status=d_status, candidate_tier=c_tier)
        reason = generate_review_reason(discovery_status=d_status, candidate_tier=c_tier, confidence_percentage=conf_pct)

        if priority == "HIGH":
            high_count += 1
        else:
            medium_count += 1

        matched_sid = item.get("matched_schedule_activity_id")
        norm_sid = normalize_id(matched_sid)
        matched_level = sched_level_lookup.get(norm_sid) if norm_sid else None

        evidence_summary = build_evidence_summary(record=item, matched_level=matched_level)

        review_records.append({
            "index": len(review_records) + 1,
            "execution_activity_id": item.get("execution_activity_id"),
            "execution_activity_name": item.get("execution_activity_name"),
            "discipline": item.get("discipline"),
            "execution_wbs": item.get("execution_wbs"),
            "candidate_tier": c_tier,
            "matched_schedule_activity_id": matched_sid,
            "matched_schedule_activity_name": item.get("matched_schedule_activity_name"),
            "matched_schedule_level": matched_level,
            "granularity_status": item.get("granularity_status"),
            "discovery_status": d_status,
            "confidence_score": item.get("confidence_score"),
            "confidence_percentage": conf_pct,
            "validation_status": item.get("validation_status"),
            "confidence_basis": item.get("confidence_basis"),
            "review_reason": reason,
            "review_priority": priority,
            "evidence_summary": evidence_summary
        })

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_review_items": len(review_records),
        "high_priority_count": high_count,
        "medium_priority_count": medium_count,
        "results": review_records
    }
