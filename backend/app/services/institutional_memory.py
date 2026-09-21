from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.services.time_agent import get_paired_activity_summaries

# In-memory Knowledge Base Records for current project
DEFAULT_MEMORY_RECORDS: List[Dict[str, Any]] = [
    {
        "memory_id": "MEM-CIV-L6-01-01",
        "activity_id": "CIV-L6-01",
        "activity_name": "Subgrade excavation and compaction",
        "discipline": "Civil",
        "actual_duration_hours": 4.5,
        "planned_duration_days": 20,
        "progress": 70.0,
        "actual_quantity": 3500.0,
        "unit": "m3",
        "productivity_pattern": "777.78 m3/h",
        "productivity_rate": 777.78,
        "delay_days": 0.0,
        "delay_severity": "LOW",
        "delay_cause": None,
        "bottleneck": "Compaction equipment density calibration required",
        "source_events": ["DPR-CIV-01", "SD-CIV-01", "EVT-START-CIV-L6-01", "EVT-END-CIV-L6-01"],
        "evidence_ids": ["EVD-DPR-CIV-01", "EVD-SD-CIV-01"],
        "project": "CURRENT_PROJECT",
        "date": "2025-01-15",
        "confidence": 0.95
    },
    {
        "memory_id": "MEM-CIV-L6-02-02",
        "activity_id": "CIV-L6-02",
        "activity_name": "Foundation rebar fixing and shuttering",
        "discipline": "Civil",
        "actual_duration_hours": None,
        "planned_duration_days": 15,
        "progress": 75.0,
        "actual_quantity": 45.0,
        "unit": "MT",
        "productivity_pattern": None,
        "productivity_rate": None,
        "delay_days": 2.0,
        "delay_severity": "MEDIUM",
        "delay_cause": "Rebar delivery logistics delay from central store",
        "bottleneck": "Rebar bending machine maintenance turnaround",
        "source_events": ["DPR-CIV-02", "SD-CIV-02"],
        "evidence_ids": ["EVD-DPR-CIV-02", "EVD-SD-CIV-02"],
        "project": "CURRENT_PROJECT",
        "date": "2025-01-15",
        "confidence": 0.90
    },
    {
        "memory_id": "MEM-PIP-L6-01-03",
        "activity_id": "PIP-L6-01",
        "activity_name": "12-inch carbon steel pipe spool pre-fabrication",
        "discipline": "Piping",
        "actual_duration_hours": 5.0,
        "planned_duration_days": 20,
        "progress": 80.0,
        "actual_quantity": 120.0,
        "unit": "m",
        "productivity_pattern": "24.0 m/h",
        "productivity_rate": 24.0,
        "delay_days": 0.0,
        "delay_severity": "LOW",
        "delay_cause": None,
        "bottleneck": "Welding booth argon gas supply pressure monitoring",
        "source_events": ["DPR-PIP-01", "SD-PIP-01", "EVT-START-PIP-L6-01", "EVT-END-PIP-L6-01"],
        "evidence_ids": ["EVD-DPR-PIP-01", "EVD-SD-PIP-01"],
        "project": "CURRENT_PROJECT",
        "date": "2025-01-15",
        "confidence": 0.98
    },
    {
        "memory_id": "MEM-MEC-L6-01-04",
        "activity_id": "MEC-L6-01",
        "activity_name": "Base plate grouting and alignment",
        "discipline": "Mechanical",
        "actual_duration_hours": 3.0,
        "planned_duration_days": 13,
        "progress": 100.0,
        "actual_quantity": 1.0,
        "unit": "ea",
        "productivity_pattern": "0.33 ea/h",
        "productivity_rate": 0.33,
        "delay_days": 0.0,
        "delay_severity": "LOW",
        "delay_cause": None,
        "bottleneck": None,
        "source_events": ["DPR-MEC-01", "EVT-START-MEC-L6-01", "EVT-END-MEC-L6-01"],
        "evidence_ids": ["EVD-DPR-MEC-01"],
        "project": "CURRENT_PROJECT",
        "date": "2025-01-15",
        "confidence": 0.95
    }
]


def get_all_memory_records() -> List[Dict[str, Any]]:
    """
    Returns all institutional memory records for the current project.
    Enriches actual durations with active Time Agent pairing where available.
    """
    paired_summaries = get_paired_activity_summaries()
    paired_map = {p["activity_id"]: p for p in paired_summaries}

    enriched = []
    for rec in DEFAULT_MEMORY_RECORDS:
        r = dict(rec)
        act_id = r["activity_id"]
        # If Time Agent has a freshly computed duration, incorporate it
        if act_id in paired_map and paired_map[act_id].get("duration_hours"):
            ta_dur = paired_map[act_id]["duration_hours"]
            r["actual_duration_hours"] = ta_dur
            if r.get("actual_quantity") and ta_dur > 0:
                rate = round(r["actual_quantity"] / ta_dur, 2)
                r["productivity_rate"] = rate
                r["productivity_pattern"] = f"{rate} {r.get('unit', '')}/h"
        enriched.append(r)

    return enriched


def get_memory_record_by_activity(activity_id: str) -> Optional[Dict[str, Any]]:
    """Returns memory record for a specific activity ID."""
    all_recs = get_all_memory_records()
    return next((r for r in all_recs if r["activity_id"].upper() == activity_id.upper().strip()), None)


def get_memory_records_by_discipline(discipline: str) -> List[Dict[str, Any]]:
    """Returns memory records filtered by discipline."""
    all_recs = get_all_memory_records()
    disc_clean = discipline.strip().lower()
    return [r for r in all_recs if r["discipline"].lower() == disc_clean]


def get_institutional_memory_summary() -> Dict[str, Any]:
    """
    Computes summary performance statistics across disciplines and project knowledge.
    Reflects the boundary that only CURRENT_PROJECT is loaded (cross_project_learning_available = False).
    """
    records = get_all_memory_records()

    # Discipline performance breakdown
    disciplines = sorted(list({r["discipline"] for r in records}))
    discipline_performance: Dict[str, Any] = {}

    for d in disciplines:
        d_recs = [r for r in records if r["discipline"] == d]
        count = len(d_recs)
        completed = sum(1 for r in d_recs if r.get("progress", 0) >= 100.0)
        delayed = sum(1 for r in d_recs if r.get("delay_days", 0) > 0)
        avg_progress = round(sum(r.get("progress", 0) for r in d_recs) / count, 1) if count else 0.0
        avg_delay = round(sum(r.get("delay_days", 0) for r in d_recs) / count, 1) if count else 0.0

        dur_recs = [r["actual_duration_hours"] for r in d_recs if r.get("actual_duration_hours") is not None]
        avg_duration_h = round(sum(dur_recs) / len(dur_recs), 2) if dur_recs else None

        discipline_performance[d] = {
            "total_activities": count,
            "completed_activities": completed,
            "delayed_activities": delayed,
            "average_progress_percent": avg_progress,
            "average_delay_days": avg_delay,
            "average_duration_hours": avg_duration_h
        }

    # Productivity patterns
    productivity_benchmarks = [
        {
            "activity_id": r["activity_id"],
            "discipline": r["discipline"],
            "rate": r["productivity_rate"],
            "unit": r.get("unit"),
            "pattern": r["productivity_pattern"]
        }
        for r in records
        if r.get("productivity_rate") is not None
    ]

    return {
        "project": "CURRENT_PROJECT",
        "total_records": len(records),
        "cross_project_learning_available": False,
        "cross_project_note": "Multi-project institutional memory repository is ready for multi-project ingestion. Single-project execution baseline currently active.",
        "discipline_performance": discipline_performance,
        "productivity_benchmarks": productivity_benchmarks,
        "database_modified": False,
        "storage": "in-memory"
    }
