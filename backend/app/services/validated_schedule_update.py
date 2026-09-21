import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.services.contradiction_detection import get_all_contradictions

# Baseline Schedule Activities reference (read-only, never mutated)
BASELINE_L5_L6_SCHEDULE: Dict[str, Dict[str, Any]] = {
    "CIV-L5-01": {
        "name": "Main Substructure Construction",
        "level": "L5",
        "discipline": "Civil",
        "planned_start": "2025-01-01",
        "planned_finish": "2025-03-31",
        "planned_quantity": 100.0,
        "unit": "%"
    },
    "CIV-L6-01": {
        "name": "Subgrade excavation and compaction",
        "level": "L6",
        "discipline": "Civil",
        "planned_start": "2025-01-01",
        "planned_finish": "2025-01-20",
        "planned_quantity": 5000.0,
        "unit": "m3"
    },
    "CIV-L6-02": {
        "name": "Foundation rebar fixing and shuttering",
        "level": "L6",
        "discipline": "Civil",
        "planned_start": "2025-01-10",
        "planned_finish": "2025-01-25",
        "planned_quantity": 60.0,
        "unit": "MT"
    },
    "CIV-L6-03": {
        "name": "M25 grade raft concrete pouring",
        "level": "L6",
        "discipline": "Civil",
        "planned_start": "2025-01-20",
        "planned_finish": "2025-02-05",
        "planned_quantity": 850.0,
        "unit": "m3"
    },
    "PIP-L5-01": {
        "name": "Process Header Piping Fabrication",
        "level": "L5",
        "discipline": "Piping",
        "planned_start": "2025-01-05",
        "planned_finish": "2025-03-15",
        "planned_quantity": 100.0,
        "unit": "%"
    },
    "PIP-L6-01": {
        "name": "12-inch carbon steel pipe spool pre-fabrication",
        "level": "L6",
        "discipline": "Piping",
        "planned_start": "2025-01-05",
        "planned_finish": "2025-01-25",
        "planned_quantity": 150.0,
        "unit": "m"
    },
    "PIP-L6-02": {
        "name": "Pipe spool fit-up and butt welding",
        "level": "L6",
        "discipline": "Piping",
        "planned_start": "2025-01-15",
        "planned_finish": "2025-02-10",
        "planned_quantity": 80.0,
        "unit": "joints"
    },
    "MEC-L5-01": {
        "name": "Compressor Package Mechanical Installation",
        "level": "L5",
        "discipline": "Mechanical",
        "planned_start": "2025-01-15",
        "planned_finish": "2025-03-30",
        "planned_quantity": 100.0,
        "unit": "%"
    },
    "MEC-L6-01": {
        "name": "Base plate grouting and alignment",
        "level": "L6",
        "discipline": "Mechanical",
        "planned_start": "2025-01-15",
        "planned_finish": "2025-01-28",
        "planned_quantity": 1.0,
        "unit": "ea"
    }
}

# Validation Status constants
STATUS_ELIGIBLE = "ELIGIBLE_FOR_UPDATE"
STATUS_BLOCKED = "BLOCKED"

# Block reasons
REASON_CONTRADICTION = "CONTRADICTION_DETECTED"
REASON_LOW_CONFIDENCE = "LOW_CONFIDENCE"
REASON_PLANNER_REVIEW = "PLANNER_REVIEW_REQUIRED"
REASON_UNMATCHED = "UNMATCHED_ACTIVITY"
REASON_INVALID = "INVALID_ACTIVITY"
REASON_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


def evaluate_schedule_updates() -> List[Dict[str, Any]]:
    """
    Evaluates field execution updates against the strict validation gate:
    - High confidence (>= 90%)
    - Zero unresolved contradictions
    - Valid baseline activity mapping
    - Valid execution progress facts
    Never mutates baseline schedule file.
    """
    # Fetch active contradictions
    active_contradictions = get_all_contradictions()
    contradictory_activity_ids = {c["activity_id"] for c in active_contradictions}

    # Candidate execution records from verified field ingestion streams
    candidate_updates = [
        # Candidate 1: PIP-L6-01 (100% confidence, zero contradictions, verified across DPR & Site Diary) -> ELIGIBLE
        {
            "activity_id": "PIP-L6-01",
            "actual_start": "2025-01-05",
            "actual_finish": None,
            "actual_progress": 80.0,
            "actual_quantity": 120.0,
            "confidence": 0.98,
            "source_event_ids": ["DPR-PIP-01", "SD-PIP-01"],
            "evidence_ids": ["EVD-DPR-PIP-01", "EVD-SD-PIP-01"],
        },
        # Candidate 2: MEC-L6-01 (95% confidence, zero contradictions, valid DPR record) -> ELIGIBLE
        {
            "activity_id": "MEC-L6-01",
            "actual_start": "2025-01-15",
            "actual_finish": None,
            "actual_progress": 100.0,
            "actual_quantity": 1.0,
            "confidence": 0.95,
            "source_event_ids": ["DPR-MEC-01"],
            "evidence_ids": ["EVD-DPR-MEC-01"],
        },
        # Candidate 3: CIV-L6-01 (Has PROGRESS_CONTRADICTION: 3500 vs 5000 m3) -> BLOCKED
        {
            "activity_id": "CIV-L6-01",
            "actual_start": "2025-01-01",
            "actual_finish": None,
            "actual_progress": 70.0,
            "actual_quantity": 3500.0,
            "confidence": 0.85,
            "source_event_ids": ["DPR-CIV-01", "SD-CIV-01"],
            "evidence_ids": ["EVD-DPR-CIV-01", "EVD-SD-CIV-01"],
        },
        # Candidate 4: CIV-L6-02 (Has STATUS & LOCATION CONTRADICTIONS) -> BLOCKED
        {
            "activity_id": "CIV-L6-02",
            "actual_start": "2025-01-10",
            "actual_finish": None,
            "actual_progress": 75.0,
            "actual_quantity": 45.0,
            "confidence": 0.82,
            "source_event_ids": ["DPR-CIV-02", "SD-CIV-02"],
            "evidence_ids": ["EVD-DPR-CIV-02", "EVD-SD-CIV-02"],
        },
        # Candidate 5: CIV-L6-03 (Has START_END_CONTRADICTION: 10:00 > 08:00) -> BLOCKED
        {
            "activity_id": "CIV-L6-03",
            "actual_start": "2025-01-15T10:00:00Z",
            "actual_finish": "2025-01-15T08:00:00Z",
            "actual_progress": 50.0,
            "actual_quantity": 425.0,
            "confidence": 0.70,
            "source_event_ids": ["EVT-START-CIV-L6-03", "EVT-END-CIV-L6-03"],
            "evidence_ids": [],
        },
        # Candidate 6: CIV-L5-01 (Has DATE & DISCIPLINE CONTRADICTIONS) -> BLOCKED
        {
            "activity_id": "CIV-L5-01",
            "actual_start": "2025-01-15",
            "actual_finish": None,
            "actual_progress": 100.0,
            "actual_quantity": 100.0,
            "confidence": 0.80,
            "source_event_ids": ["DPR-CIV5-01", "DOC-CIV5-01"],
            "evidence_ids": ["EVD-DPR-CIV5-01", "EVD-DOC-CIV5-01"],
        },
        # Candidate 7: UNMATCHED-ACT-99 (Unmatched scope from site notes) -> BLOCKED
        {
            "activity_id": "NEW-DISCOVERY-01",
            "actual_start": "2025-01-12",
            "actual_finish": None,
            "actual_progress": 10.0,
            "actual_quantity": 10.0,
            "confidence": 0.45,
            "source_event_ids": ["DPR-NEW-01"],
            "evidence_ids": [],
        }
    ]

    evaluated_records: List[Dict[str, Any]] = []

    for idx, c in enumerate(candidate_updates, 1):
        act_id = c["activity_id"]
        baseline_act = BASELINE_L5_L6_SCHEDULE.get(act_id)

        # Determine level
        act_level = baseline_act["level"] if baseline_act else "UNKNOWN"
        act_name = baseline_act["name"] if baseline_act else "Unrecognized Field Activity"
        discipline = baseline_act["discipline"] if baseline_act else "General"
        planned_start = baseline_act["planned_start"] if baseline_act else None
        planned_finish = baseline_act["planned_finish"] if baseline_act else None
        planned_qty = baseline_act["planned_quantity"] if baseline_act else 0.0
        unit = baseline_act["unit"] if baseline_act else "-"

        # Quantity variance: actual - planned
        act_qty = c.get("actual_quantity", 0.0)
        variance = round(act_qty - planned_qty, 2) if baseline_act else 0.0

        # Gating checks
        validation_status = STATUS_ELIGIBLE
        block_reason = None

        if not baseline_act:
            validation_status = STATUS_BLOCKED
            block_reason = REASON_UNMATCHED
        elif act_id in contradictory_activity_ids:
            validation_status = STATUS_BLOCKED
            block_reason = REASON_CONTRADICTION
        elif c.get("confidence", 0) < 0.90:
            validation_status = STATUS_BLOCKED
            block_reason = REASON_PLANNER_REVIEW
        elif not c.get("evidence_ids") and not c.get("source_event_ids"):
            validation_status = STATUS_BLOCKED
            block_reason = REASON_INSUFFICIENT_EVIDENCE

        update_status = "PENDING" if validation_status == STATUS_ELIGIBLE else "BLOCKED"
        pmis_ready = (validation_status == STATUS_ELIGIBLE)

        evaluated_records.append({
            "update_id": f"UPD-{act_id}-{idx:02d}",
            "activity_id": act_id,
            "activity_name": act_name,
            "discipline": discipline,
            "activity_level": act_level,
            "planned_start": planned_start,
            "planned_finish": planned_finish,
            "actual_start": c.get("actual_start"),
            "actual_finish": c.get("actual_finish"),
            "actual_progress": c.get("actual_progress"),
            "planned_quantity": planned_qty,
            "actual_quantity": act_qty,
            "unit": unit,
            "variance": variance,
            "confidence": c.get("confidence"),
            "source_event_ids": c.get("source_event_ids", []),
            "evidence_ids": c.get("evidence_ids", []),
            "validation_status": validation_status,
            "block_reason": block_reason,
            "update_status": update_status,
            "pmis_target": "ORACLE_PRIMAVERA_P6",
            "pmis_ready": pmis_ready,
            "database_modified": False,
            "baseline_modified": False
        })

    return evaluated_records


def get_update_summary() -> Dict[str, Any]:
    """Returns aggregate counts for schedule update validation gate."""
    updates = evaluate_schedule_updates()
    total = len(updates)
    eligible = sum(1 for u in updates if u["validation_status"] == STATUS_ELIGIBLE)
    blocked = sum(1 for u in updates if u["validation_status"] == STATUS_BLOCKED)
    contradictions = sum(1 for u in updates if u["block_reason"] == REASON_CONTRADICTION)
    planner_review = sum(1 for u in updates if u["block_reason"] == REASON_PLANNER_REVIEW)
    unmatched = sum(1 for u in updates if u["block_reason"] == REASON_UNMATCHED)

    return {
        "total": total,
        "eligible": eligible,
        "blocked": blocked,
        "planner_review": planner_review,
        "contradictions": contradictions,
        "unmatched": unmatched,
        "database_modified": False,
        "baseline_modified": False
    }


def generate_pmis_update_preview() -> Dict[str, Any]:
    """
    Generates simulated local PMIS update export payload.
    Read-only preview; strictly never modifies the baseline schedule.
    """
    updates = evaluate_schedule_updates()
    eligible_updates = [u for u in updates if u["validation_status"] == STATUS_ELIGIBLE]

    preview_payload = {
        "pmis_format": "PRIMAVERA_P6_XML_SIMULATED",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": "INFRASYNC-PROJECT-01",
        "target_pmis": "Oracle Primavera P6 EPPM / MS Project",
        "baseline_safe": True,
        "baseline_modified": False,
        "database_modified": False,
        "total_updates_ready": len(eligible_updates),
        "activities_to_update": [
            {
                "activity_id": u["activity_id"],
                "activity_name": u["activity_name"],
                "level": u["activity_level"],
                "discipline": u["discipline"],
                "actual_start": u["actual_start"],
                "actual_finish": u["actual_finish"],
                "actual_progress": u["actual_progress"],
                "variance": u["variance"],
                "evidence_references": u["evidence_ids"]
            }
            for u in eligible_updates
        ]
    }
    return preview_payload
