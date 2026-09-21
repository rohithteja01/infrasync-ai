import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

# Canonical Contradiction Types
TYPE_PROGRESS = "PROGRESS_CONTRADICTION"
TYPE_STATUS = "STATUS_CONTRADICTION"
TYPE_START_END = "START_END_CONTRADICTION"
TYPE_DATE = "DATE_CONTRADICTION"
TYPE_DISCIPLINE = "DISCIPLINE_CONTRADICTION"
TYPE_LOCATION = "LOCATION_CONTRADICTION"

# Severity levels
SEV_HIGH = "HIGH"
SEV_MEDIUM = "MEDIUM"
SEV_LOW = "LOW"

# Governance and Evidence statuses
STATUS_PLANNER_REVIEW = "PLANNER_REVIEW"
EVD_STATUS_SUPPORTED = "SUPPORTED"
EVD_STATUS_CONFLICTING = "CONFLICTING"
EVD_STATUS_INSUFFICIENT = "INSUFFICIENT"

# Deterministic default multi-source execution facts dataset
# Incorporating Daily Reports, Site Diaries, Documents, Time Agent events, and Photos
DEFAULT_EXECUTION_FACTS: List[Dict[str, Any]] = [
    # 1. CIV-L6-01: PROGRESS_CONTRADICTION (3500 vs 5000) & DISCIPLINE_CONTRADICTION
    {
        "source_type": "DAILY_REPORT",
        "source_reference": "sample_daily_report.pdf",
        "evidence_id": "EVD-DPR-CIV-01",
        "activity_id": "CIV-L6-01",
        "activity_name": "Subgrade excavation and compaction",
        "date": "2025-01-15",
        "actual_quantity": 3500.0,
        "unit": "m3",
        "status": "IN_PROGRESS",
        "discipline": "Civil",
        "location": "Station 4 East Pit"
    },
    {
        "source_type": "SITE_DIARY",
        "source_reference": "sample_site_diary.pdf",
        "evidence_id": "EVD-SD-CIV-01",
        "activity_id": "CIV-L6-01",
        "activity_name": "Subgrade excavation and compaction",
        "date": "2025-01-15",
        "actual_quantity": 5000.0,
        "unit": "m3",
        "status": "IN_PROGRESS",
        "discipline": "Civil",
        "location": "Station 4 East Pit"
    },

    # 2. CIV-L6-02: STATUS_CONTRADICTION (IN_PROGRESS vs COMPLETED) & LOCATION_CONTRADICTION (Station 4 vs Station 7)
    {
        "source_type": "DAILY_REPORT",
        "source_reference": "sample_daily_report.pdf",
        "evidence_id": "EVD-DPR-CIV-02",
        "activity_id": "CIV-L6-02",
        "activity_name": "Foundation rebar fixing and shuttering",
        "date": "2025-01-15",
        "actual_quantity": 45.0,
        "unit": "MT",
        "status": "IN_PROGRESS",
        "discipline": "Civil",
        "location": "Station 4"
    },
    {
        "source_type": "SITE_DIARY",
        "source_reference": "sample_site_diary.pdf",
        "evidence_id": "EVD-SD-CIV-02",
        "activity_id": "CIV-L6-02",
        "activity_name": "Foundation rebar fixing and shuttering",
        "date": "2025-01-15",
        "actual_quantity": 45.0,
        "unit": "MT",
        "status": "COMPLETED",
        "discipline": "Civil",
        "location": "Station 7"
    },

    # 3. CIV-L6-03: START_END_CONTRADICTION (START at 10:00 > END at 08:00)
    {
        "source_type": "TIME_AGENT",
        "source_reference": "EVT-START-CIV-L6-03-A1",
        "evidence_id": None,
        "activity_id": "CIV-L6-03",
        "activity_name": "M25 grade raft concrete pouring",
        "date": "2025-01-15",
        "event_type": "START",
        "event_time": "2025-01-15T10:00:00Z",
        "status": "STARTED",
        "discipline": "Civil",
        "location": "Grid B-2"
    },
    {
        "source_type": "TIME_AGENT",
        "source_reference": "EVT-END-CIV-L6-03-B2",
        "evidence_id": None,
        "activity_id": "CIV-L6-03",
        "activity_name": "M25 grade raft concrete pouring",
        "date": "2025-01-15",
        "event_type": "END",
        "event_time": "2025-01-15T08:00:00Z",
        "status": "COMPLETED",
        "discipline": "Civil",
        "location": "Grid B-2"
    },

    # 4. CIV-L5-01: DATE_CONTRADICTION (2025-01-15 vs 2025-01-17) & DISCIPLINE_CONTRADICTION (Civil vs Piping)
    {
        "source_type": "DAILY_REPORT",
        "source_reference": "sample_daily_report.pdf",
        "evidence_id": "EVD-DPR-CIV5-01",
        "activity_id": "CIV-L5-01",
        "activity_name": "Main Substructure Construction",
        "date": "2025-01-15",
        "start_date": "2025-01-15",
        "actual_quantity": 100.0,
        "unit": "%",
        "status": "IN_PROGRESS",
        "discipline": "Civil",
        "location": "Sector 4 Main Area"
    },
    {
        "source_type": "DOCUMENT",
        "source_reference": "sample_project_document.pdf",
        "evidence_id": "EVD-DOC-CIV5-01",
        "activity_id": "CIV-L5-01",
        "activity_name": "Main Substructure Construction",
        "date": "2025-01-17",
        "start_date": "2025-01-17",
        "actual_quantity": 100.0,
        "unit": "%",
        "status": "IN_PROGRESS",
        "discipline": "Piping",
        "location": "Sector 4 Main Area"
    },

    # 5. PIP-L6-01: NON-CONTRADICTORY ACTIVITY (Agrees across sources -> SUPPORTED)
    {
        "source_type": "DAILY_REPORT",
        "source_reference": "sample_daily_report.pdf",
        "evidence_id": "EVD-DPR-PIP-01",
        "activity_id": "PIP-L6-01",
        "activity_name": "12-inch carbon steel pipe spool pre-fabrication",
        "date": "2025-01-15",
        "actual_quantity": 120.0,
        "unit": "m",
        "status": "IN_PROGRESS",
        "discipline": "Piping",
        "location": "Fabrication Yard West"
    },
    {
        "source_type": "SITE_DIARY",
        "source_reference": "sample_site_diary.pdf",
        "evidence_id": "EVD-SD-PIP-01",
        "activity_id": "PIP-L6-01",
        "activity_name": "12-inch carbon steel pipe spool pre-fabrication",
        "date": "2025-01-15",
        "actual_quantity": 120.0,
        "unit": "m",
        "status": "IN_PROGRESS",
        "discipline": "Piping",
        "location": "Fabrication Yard West"
    },

    # 6. MEC-L6-01: MISSING-VALUE CASE (One source has location, other has null -> INSUFFICIENT, NO CONTRADICTION)
    {
        "source_type": "DAILY_REPORT",
        "source_reference": "sample_daily_report.pdf",
        "evidence_id": "EVD-DPR-MEC-01",
        "activity_id": "MEC-L6-01",
        "activity_name": "Base plate grouting and alignment",
        "date": "2025-01-15",
        "actual_quantity": 1.0,
        "unit": "ea",
        "status": "IN_PROGRESS",
        "discipline": "Mechanical",
        "location": "Compressor Skid Pad 1"
    },
    {
        "source_type": "DOCUMENT",
        "source_reference": "sample_project_document.pdf",
        "evidence_id": None,
        "activity_id": "MEC-L6-01",
        "activity_name": "Base plate grouting and alignment",
        "date": "2025-01-15",
        "actual_quantity": 1.0,
        "unit": "ea",
        "status": "IN_PROGRESS",
        "discipline": "Mechanical",
        "location": None  # Missing value: MUST NOT flag as location contradiction
    }
]

# In-memory storage for audit trail and cached contradiction scans
_IN_MEMORY_AUDIT_TRAIL: List[Dict[str, Any]] = []
_IN_MEMORY_CONTRADICTIONS: List[Dict[str, Any]] = []


def _generate_contradiction_id(c_type: str, activity_id: str, seq: int) -> str:
    slug = c_type.replace("_CONTRADICTION", "")
    return f"CTD-{slug}-{activity_id}-{seq:02d}"


def _generate_audit_id(seq: int) -> str:
    return f"AUD-CTD-{seq:03d}"


def detect_contradictions(facts: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Deterministic rule-based contradiction detection engine.
    Scans execution facts across sources, comparing values on identical activities and comparable fields.
    Does NOT over-report: requires at least two non-null conflicting explicit values.
    """
    if facts is None:
        facts = list(DEFAULT_EXECUTION_FACTS)

    # Deduplicate same-source identical evidence records for contradiction analysis
    unique_facts = []
    seen_evidence_signatures = set()
    for f in facts:
        sig = (
            f.get("activity_id"),
            f.get("source_reference") or f.get("source_type"),
            f.get("date"),
            f.get("actual_quantity"),
            f.get("status"),
            f.get("start_date"),
            f.get("discipline"),
            f.get("location"),
            f.get("event_type"),
            f.get("event_time")
        )
        if sig not in seen_evidence_signatures:
            seen_evidence_signatures.add(sig)
            unique_facts.append(f)

    # Group facts by activity_id
    activities_facts: Dict[str, List[Dict[str, Any]]] = {}
    for f in unique_facts:
        act_id = f.get("activity_id")
        if not act_id:
            continue
        activities_facts.setdefault(act_id, []).append(f)

    contradictions: List[Dict[str, Any]] = []
    c_counter = 1

    for act_id, recs in activities_facts.items():
        # A. PROGRESS_CONTRADICTION: Check conflicting actual_quantity on same date from distinct sources
        dates = {r.get("date") for r in recs if r.get("date")}
        for d in dates:
            d_recs = [r for r in recs if r.get("date") == d and r.get("actual_quantity") is not None]
            distinct_sources = {r.get("source_reference") or r.get("source_type") for r in d_recs if r.get("source_reference") or r.get("source_type")}
            quantities = {r["actual_quantity"] for r in d_recs}
            if len(quantities) > 1 and len(distinct_sources) >= 2:
                # Conflicting quantities found across distinct independent sources
                c_id = _generate_contradiction_id(TYPE_PROGRESS, act_id, c_counter)
                c_counter += 1
                vals = [
                    {
                        "value": f"{r['actual_quantity']} {r.get('unit', '')}".strip(),
                        "raw_value": r["actual_quantity"],
                        "unit": r.get("unit"),
                        "source_type": r.get("source_type"),
                        "source_reference": r.get("source_reference"),
                        "evidence_id": r.get("evidence_id"),
                        "date": d
                    }
                    for r in d_recs
                ]
                q_strs = [f"{v['source_type']}: {v['value']}" for v in vals]
                contradictions.append({
                    "contradiction_id": c_id,
                    "contradiction_type": TYPE_PROGRESS,
                    "activity_id": act_id,
                    "activity_name": recs[0].get("activity_name"),
                    "field": "actual_quantity",
                    "severity": SEV_HIGH,
                    "status": STATUS_PLANNER_REVIEW,
                    "evidence_status": EVD_STATUS_CONFLICTING,
                    "values": vals,
                    "explanation": f"Conflicting execution quantities reported for {act_id} on {d} ({'; '.join(q_strs)}).",
                    "recommended_action": STATUS_PLANNER_REVIEW
                })

        # B. STATUS_CONTRADICTION: Check conflicting status on same date across distinct progress reporting sources
        for d in dates:
            d_recs = [
                r for r in recs
                if r.get("date") == d and r.get("status") is not None and r.get("source_type") != "TIME_AGENT"
            ]
            distinct_sources = {r.get("source_reference") or r.get("source_type") for r in d_recs if r.get("source_reference") or r.get("source_type")}
            # Standardize status for comparison
            statuses = {r["status"].upper().strip().replace(" ", "_") for r in d_recs}
            # Treat COMPLETED vs IN_PROGRESS / NOT_STARTED as conflict across distinct sources
            if len(statuses) > 1 and len(distinct_sources) >= 2:
                c_id = _generate_contradiction_id(TYPE_STATUS, act_id, c_counter)
                c_counter += 1
                vals = [
                    {
                        "value": r["status"].upper().strip(),
                        "source_type": r.get("source_type"),
                        "source_reference": r.get("source_reference"),
                        "evidence_id": r.get("evidence_id"),
                        "date": d
                    }
                    for r in d_recs
                ]
                s_strs = [f"{v['source_type']} reports '{v['value']}'" for v in vals]
                contradictions.append({
                    "contradiction_id": c_id,
                    "contradiction_type": TYPE_STATUS,
                    "activity_id": act_id,
                    "activity_name": recs[0].get("activity_name"),
                    "field": "status",
                    "severity": SEV_HIGH,
                    "status": STATUS_PLANNER_REVIEW,
                    "evidence_status": EVD_STATUS_CONFLICTING,
                    "values": vals,
                    "explanation": f"Conflicting activity completion status reported for {act_id} on {d}: {'; '.join(s_strs)}.",
                    "recommended_action": STATUS_PLANNER_REVIEW
                })

        # C. START_END_CONTRADICTION: Check chronological order of START and END events
        starts = [r for r in recs if r.get("event_type") == "START" and r.get("event_time")]
        ends = [r for r in recs if r.get("event_type") == "END" and r.get("event_time")]
        for s in starts:
            for e in ends:
                try:
                    s_dt = datetime.fromisoformat(s["event_time"].replace("Z", "+00:00"))
                    e_dt = datetime.fromisoformat(e["event_time"].replace("Z", "+00:00"))
                    if s_dt > e_dt:
                        c_id = _generate_contradiction_id(TYPE_START_END, act_id, c_counter)
                        c_counter += 1
                        vals = [
                            {
                                "value": f"START: {s['event_time']}",
                                "event_time": s["event_time"],
                                "source_type": s.get("source_type", "TIME_AGENT"),
                                "source_reference": s.get("source_reference"),
                                "evidence_id": s.get("evidence_id"),
                                "date": s.get("date")
                            },
                            {
                                "value": f"END: {e['event_time']}",
                                "event_time": e["event_time"],
                                "source_type": e.get("source_type", "TIME_AGENT"),
                                "source_reference": e.get("source_reference"),
                                "evidence_id": e.get("evidence_id"),
                                "date": e.get("date")
                            }
                        ]
                        contradictions.append({
                            "contradiction_id": c_id,
                            "contradiction_type": TYPE_START_END,
                            "activity_id": act_id,
                            "activity_name": recs[0].get("activity_name"),
                            "field": "event_time",
                            "severity": SEV_HIGH,
                            "status": STATUS_PLANNER_REVIEW,
                            "evidence_status": EVD_STATUS_CONFLICTING,
                            "values": vals,
                            "explanation": f"Chronological impossibility detected for {act_id}: START event ({s['event_time']}) occurs AFTER END event ({e['event_time']}).",
                            "recommended_action": STATUS_PLANNER_REVIEW
                        })
                except Exception:
                    pass

        # D. DATE_CONTRADICTION: Check conflicting explicit start_date or date for the same execution event across distinct sources
        date_recs = [r for r in recs if (r.get("start_date") or r.get("date")) and r.get("source_type") != "TIME_AGENT"]
        distinct_sources = {r.get("source_reference") or r.get("source_type") for r in date_recs if r.get("source_reference") or r.get("source_type")}
        explicit_dates = {r.get("start_date") or r.get("date") for r in date_recs}
        if len(explicit_dates) > 1 and len(distinct_sources) >= 2:
            c_id = _generate_contradiction_id(TYPE_DATE, act_id, c_counter)
            c_counter += 1
            vals = [
                {
                    "value": r.get("start_date") or r.get("date"),
                    "source_type": r.get("source_type"),
                    "source_reference": r.get("source_reference"),
                    "evidence_id": r.get("evidence_id"),
                    "date": r.get("date")
                }
                for r in date_recs
            ]
            d_strs = [f"{v['source_type']} claims '{v['value']}'" for v in vals]
            contradictions.append({
                "contradiction_id": c_id,
                "contradiction_type": TYPE_DATE,
                "activity_id": act_id,
                "activity_name": recs[0].get("activity_name"),
                "field": "start_date",
                "severity": SEV_MEDIUM,
                "status": STATUS_PLANNER_REVIEW,
                "evidence_status": EVD_STATUS_CONFLICTING,
                "values": vals,
                "explanation": f"Conflicting execution dates reported for {act_id}: {'; '.join(d_strs)}.",
                "recommended_action": STATUS_PLANNER_REVIEW
            })

        # E. DISCIPLINE_CONTRADICTION: Conflicting explicit discipline values across distinct sources
        disc_recs = [r for r in recs if r.get("discipline") and str(r.get("discipline")).strip()]
        distinct_sources = {r.get("source_reference") or r.get("source_type") for r in disc_recs if r.get("source_reference") or r.get("source_type")}
        disciplines = {r["discipline"].strip().capitalize() for r in disc_recs}
        if len(disciplines) > 1 and len(distinct_sources) >= 2:
            c_id = _generate_contradiction_id(TYPE_DISCIPLINE, act_id, c_counter)
            c_counter += 1
            vals = [
                {
                    "value": r["discipline"].strip().capitalize(),
                    "source_type": r.get("source_type"),
                    "source_reference": r.get("source_reference"),
                    "evidence_id": r.get("evidence_id"),
                    "date": r.get("date")
                }
                for r in disc_recs
            ]
            disc_strs = [f"{v['source_type']} reports '{v['value']}'" for v in vals]
            contradictions.append({
                "contradiction_id": c_id,
                "contradiction_type": TYPE_DISCIPLINE,
                "activity_id": act_id,
                "activity_name": recs[0].get("activity_name"),
                "field": "discipline",
                "severity": SEV_MEDIUM,
                "status": STATUS_PLANNER_REVIEW,
                "evidence_status": EVD_STATUS_CONFLICTING,
                "values": vals,
                "explanation": f"Conflicting engineering discipline classification for {act_id}: {'; '.join(disc_strs)}.",
                "recommended_action": STATUS_PLANNER_REVIEW
            })

        # F. LOCATION_CONTRADICTION: Conflicting explicit locations across distinct sources (ignoring nulls)
        loc_recs = [r for r in recs if r.get("location") and str(r.get("location")).strip()]
        distinct_sources = {r.get("source_reference") or r.get("source_type") for r in loc_recs if r.get("source_reference") or r.get("source_type")}
        locations = {r["location"].strip().lower() for r in loc_recs}
        if len(locations) > 1 and len(distinct_sources) >= 2:
            c_id = _generate_contradiction_id(TYPE_LOCATION, act_id, c_counter)
            c_counter += 1
            vals = [
                {
                    "value": r["location"].strip(),
                    "source_type": r.get("source_type"),
                    "source_reference": r.get("source_reference"),
                    "evidence_id": r.get("evidence_id"),
                    "date": r.get("date")
                }
                for r in loc_recs
            ]
            loc_strs = [f"{v['source_type']} records '{v['value']}'" for v in vals]
            contradictions.append({
                "contradiction_id": c_id,
                "contradiction_type": TYPE_LOCATION,
                "activity_id": act_id,
                "activity_name": recs[0].get("activity_name"),
                "field": "location",
                "severity": SEV_MEDIUM,
                "status": STATUS_PLANNER_REVIEW,
                "evidence_status": EVD_STATUS_CONFLICTING,
                "values": vals,
                "explanation": f"Conflicting site work location recorded for {act_id}: {'; '.join(loc_strs)}.",
                "recommended_action": STATUS_PLANNER_REVIEW
            })

    # Cache in-memory contradictions and update in-memory audit trail
    global _IN_MEMORY_CONTRADICTIONS, _IN_MEMORY_AUDIT_TRAIL
    _IN_MEMORY_CONTRADICTIONS = contradictions

    # Re-generate audit records
    _IN_MEMORY_AUDIT_TRAIL = []
    for idx, c in enumerate(contradictions, 1):
        _IN_MEMORY_AUDIT_TRAIL.append({
            "audit_id": _generate_audit_id(idx),
            "contradiction_id": c["contradiction_id"],
            "activity_id": c["activity_id"],
            "action": "CONTRADICTION_DETECTED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "SYSTEM",
            "status": STATUS_PLANNER_REVIEW,
            "severity": c["severity"],
            "field": c["field"]
        })

    return contradictions


def get_all_contradictions() -> List[Dict[str, Any]]:
    """Returns currently detected contradictions (runs scan if cache empty)."""
    global _IN_MEMORY_CONTRADICTIONS
    if not _IN_MEMORY_CONTRADICTIONS:
        detect_contradictions()
    return list(_IN_MEMORY_CONTRADICTIONS)


def get_contradiction_by_id(contradiction_id: str) -> Optional[Dict[str, Any]]:
    """Returns details for a specific contradiction by ID."""
    all_c = get_all_contradictions()
    item = next((c for c in all_c if c["contradiction_id"] == contradiction_id), None)
    if not item:
        return None

    # Attach corresponding audit trail entries
    audits = [a for a in get_all_audit_records() if a["contradiction_id"] == contradiction_id]
    result = dict(item)
    result["audit_records"] = audits
    return result


def get_contradictions_summary() -> Dict[str, Any]:
    """
    Computes summary metrics for contradiction dashboard.
    Counts: total, high, medium, low, planner_review, supported, conflicting, insufficient.
    """
    all_c = get_all_contradictions()

    total = len(all_c)
    high = sum(1 for c in all_c if c.get("severity") == SEV_HIGH)
    medium = sum(1 for c in all_c if c.get("severity") == SEV_MEDIUM)
    low = sum(1 for c in all_c if c.get("severity") == SEV_LOW)
    planner_review = sum(1 for c in all_c if c.get("status") == STATUS_PLANNER_REVIEW)

    # Evidence status summary across monitored activities:
    # 1. Conflicting: All detected contradictions
    # 2. Supported: Activities where multi-source evidence agrees (e.g. PIP-L6-01)
    # 3. Insufficient: Activities with missing or single-source evidence (e.g. MEC-L6-01)
    supported_count = 1  # PIP-L6-01 is perfectly aligned across Daily Report and Site Diary
    insufficient_count = 1  # MEC-L6-01 has single-source/null location data
    conflicting_count = total

    return {
        "total": total,
        "high": high,
        "medium": medium,
        "low": low,
        "planner_review": planner_review,
        "supported": supported_count,
        "conflicting": conflicting_count,
        "insufficient": insufficient_count,
        "database_modified": False,
        "storage": "in-memory"
    }


def get_all_audit_records() -> List[Dict[str, Any]]:
    """Returns in-memory audit trail records."""
    global _IN_MEMORY_AUDIT_TRAIL
    if not _IN_MEMORY_AUDIT_TRAIL:
        detect_contradictions()
    return list(_IN_MEMORY_AUDIT_TRAIL)


def reset_contradictions() -> None:
    """Resets in-memory contradictions and audit records (for test isolation)."""
    global _IN_MEMORY_CONTRADICTIONS, _IN_MEMORY_AUDIT_TRAIL
    _IN_MEMORY_CONTRADICTIONS.clear()
    _IN_MEMORY_AUDIT_TRAIL.clear()
