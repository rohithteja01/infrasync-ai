import difflib
import math
import re
from collections import Counter
from typing import Dict, Any, List, Optional


def normalize_id(activity_id: Any) -> Optional[str]:
    """
    Normalizes Activity ID strictly by stripping leading/trailing whitespace and uppercase normalization.
    Preserves exact character structure without substring extraction or fuzzy alterations.
    """
    if activity_id is None:
        return None
    cleaned = str(activity_id).strip()
    if not cleaned:
        return None
    return cleaned.upper()


def compute_similarity(str1: str, str2: str) -> float:
    """
    Lightweight local text-similarity using difflib.SequenceMatcher with token-based normalization.
    Compares cleaned direct string sequences and token-sorted sequences, returning the best score.
    Zero external APIs, zero LLM calls.
    """
    if not str1 or not str2:
        return 0.0

    s1_clean = re.sub(r'[^\w\s]', ' ', str(str1).lower()).strip()
    s2_clean = re.sub(r'[^\w\s]', ' ', str(str2).lower()).strip()
    if not s1_clean or not s2_clean:
        return 0.0

    # 1. Direct sequence comparison on normalized string
    ratio_direct = difflib.SequenceMatcher(None, s1_clean, s2_clean).ratio()

    # 2. Token-sorted comparison (order-independent similarity)
    tokens1 = ' '.join(sorted(s1_clean.split()))
    tokens2 = ' '.join(sorted(s2_clean.split()))
    ratio_tokens = difflib.SequenceMatcher(None, tokens1, tokens2).ratio()

    return max(ratio_direct, ratio_tokens)


def build_context_document(
    name: Optional[str] = "",
    work_desc: Optional[str] = "",
    discipline: Optional[str] = "",
    wbs: Optional[str] = ""
) -> str:
    """
    Constructs a rich contextual text representation from activity name, work description,
    discipline, and WBS for local semantic matching.
    """
    parts = []
    if discipline and str(discipline).strip() and str(discipline).strip().lower() not in ("none", "null", "-", "general"):
        parts.append(str(discipline).strip())
    if name and str(name).strip():
        parts.append(str(name).strip())
    if work_desc and str(work_desc).strip() and str(work_desc).strip().lower() != str(name).strip().lower():
        parts.append(str(work_desc).strip())
    if wbs and str(wbs).strip() and str(wbs).strip() != "-":
        parts.append(str(wbs).strip())
    return " ".join(parts)


def tokenize_context(text: str) -> List[str]:
    """Tokenizes alphanumeric words with length >= 2 for local TF-IDF computation."""
    if not text:
        return []
    return re.findall(r'\b[a-zA-Z0-9]{2,}\b', text.lower())


def compute_tfidf_vectors(documents: List[str]) -> List[Dict[str, float]]:
    """
    Pure-Python TF-IDF vectorizer. Zero external libraries, zero memory footprint.
    Computes L2-normalized TF-IDF term vectors.
    """
    doc_tokens = [tokenize_context(doc) for doc in documents]
    N = len(documents)
    if N == 0:
        return []

    # Document Frequency
    df: Counter = Counter()
    for tokens in doc_tokens:
        unique_tokens = set(tokens)
        for t in unique_tokens:
            df[t] += 1

    # Inverse Document Frequency (smooth IDF)
    idf = {t: math.log((N + 1) / (df[t] + 1)) + 1.0 for t in df}

    vectors: List[Dict[str, float]] = []
    for tokens in doc_tokens:
        if not tokens:
            vectors.append({})
            continue
        tf = Counter(tokens)
        vec: Dict[str, float] = {}
        norm_sq = 0.0
        doc_len = len(tokens)
        for t, count in tf.items():
            val = (count / doc_len) * idf.get(t, 1.0)
            vec[t] = val
            norm_sq += val * val

        norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
        vec = {t: val / norm for t, val in vec.items()}
        vectors.append(vec)

    return vectors


def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Computes cosine similarity between two L2-normalized sparse vectors."""
    if not vec1 or not vec2:
        return 0.0
    common = set(vec1.keys()) & set(vec2.keys())
    return float(sum(vec1[t] * vec2[t] for t in common))


def match_exact_id(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.7: Strict Exact ID Matching engine.
    Matches an execution activity with a baseline schedule activity using:
    normalized_execution_activity_id == normalized_schedule_activity_id
    """
    schedule_index: Dict[str, Dict[str, Any]] = {}
    for item in schedule_activities:
        sched_id = normalize_id(item.get("activity_id"))
        if sched_id and sched_id not in schedule_index:
            schedule_index[sched_id] = item

    results: List[Dict[str, Any]] = []
    exact_matches_count = 0
    unmatched_count = 0

    for idx, exec_act in enumerate(execution_activities):
        exec_id_raw = exec_act.get("activity_id")
        norm_exec_id = normalize_id(exec_id_raw)

        if norm_exec_id and norm_exec_id in schedule_index:
            matched_sched = schedule_index[norm_exec_id]
            exact_matches_count += 1
            results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id_raw,
                "execution_activity_name": exec_act.get("activity_name"),
                "schedule_activity_id": matched_sched.get("activity_id"),
                "schedule_activity_name": matched_sched.get("activity_name"),
                "schedule_level": matched_sched.get("level"),
                "discipline": matched_sched.get("discipline") or exec_act.get("discipline"),
                "match_type": "exact_id",
                "match_status": "matched"
            })
        else:
            unmatched_count += 1
            results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id_raw,
                "execution_activity_name": exec_act.get("activity_name"),
                "schedule_activity_id": None,
                "schedule_activity_name": None,
                "schedule_level": None,
                "discipline": exec_act.get("discipline"),
                "match_type": "exact_id",
                "match_status": "unmatched"
            })

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_execution_activities": len(results),
        "exact_matches": exact_matches_count,
        "unmatched_activities": unmatched_count,
        "matches": results
    }


def match_fuzzy_activities(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    threshold: float = 0.70,
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.8: Fuzzy Activity Matching engine.
    Processes ONLY execution activities that are 'unmatched' after Feature 2.7 exact ID matching.
    Exact matches from Feature 2.7 are NEVER processed or duplicated.
    """
    exact_res = match_exact_id(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    unmatched_exact = [
        m for m in exact_res["matches"]
        if m.get("match_status") == "unmatched"
    ]

    fuzzy_results: List[Dict[str, Any]] = []
    possible_matches_count = 0
    no_match_count = 0

    for idx, item in enumerate(unmatched_exact):
        exec_id = item.get("execution_activity_id")
        exec_name = item.get("execution_activity_name") or ""

        best_candidate: Optional[Dict[str, Any]] = None
        best_score = 0.0

        for sched_act in schedule_activities:
            sched_name = sched_act.get("activity_name") or ""
            score = compute_similarity(exec_name, sched_name)
            if score > best_score:
                best_score = score
                best_candidate = sched_act

        rounded_score = round(best_score, 4)
        pct_str = f"{int(round(rounded_score * 100))}%"

        if best_score >= threshold and best_candidate:
            possible_matches_count += 1
            fuzzy_results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id,
                "execution_activity_name": exec_name,
                "suggested_schedule_activity_id": best_candidate.get("activity_id"),
                "suggested_schedule_activity_name": best_candidate.get("activity_name"),
                "suggested_schedule_level": best_candidate.get("level"),
                "suggested_discipline": best_candidate.get("discipline") or item.get("discipline"),
                "similarity_score": rounded_score,
                "similarity_percentage": pct_str,
                "match_type": "fuzzy",
                "match_status": "possible_match"
            })
        else:
            no_match_count += 1
            fuzzy_results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id,
                "execution_activity_name": exec_name,
                "suggested_schedule_activity_id": best_candidate.get("activity_id") if best_candidate else None,
                "suggested_schedule_activity_name": best_candidate.get("activity_name") if best_candidate else None,
                "suggested_schedule_level": best_candidate.get("level") if best_candidate else None,
                "suggested_discipline": best_candidate.get("discipline") if best_candidate else item.get("discipline"),
                "similarity_score": rounded_score,
                "similarity_percentage": pct_str,
                "match_type": "fuzzy",
                "match_status": "unmatched"
            })

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "threshold": threshold,
        "unmatched_execution_count": len(fuzzy_results),
        "possible_fuzzy_matches": possible_matches_count,
        "no_match_count": no_match_count,
        "matches": fuzzy_results
    }


def match_semantic_activities(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    threshold: float = 0.70,
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.9: Context / Semantic Activity Matching engine.
    Input Isolation Pipeline:
    1. Exact ID matching runs first -> exclude exact matches.
    2. Fuzzy matching runs on the remainder -> exclude fuzzy 'possible_match' items.
    3. ONLY the remaining unresolved execution activities enter Semantic Matching.

    Builds combined context representations (name + description + discipline + WBS)
    and computes lightweight TF-IDF cosine similarity scores against baseline schedule activities.
    Score >= threshold -> possible_match (never auto-confirmed)
    Score < threshold -> unmatched
    """
    # 1. Run fuzzy matching (which internally runs exact matching first)
    fuzzy_res = match_fuzzy_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=threshold,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )

    # 2. Filter strictly for unresolved activities (where fuzzy match_status == 'unmatched')
    unresolved_fuzzy_ids = {
        m["execution_activity_id"]
        for m in fuzzy_res["matches"]
        if m.get("match_status") == "unmatched"
    }

    # Map raw execution activities by ID to retrieve rich fields (work_description, discipline, wbs)
    exec_dict = {
        act.get("activity_id"): act
        for act in execution_activities
    }

    # Prepare list of unresolved execution activities
    unresolved_execution: List[Dict[str, Any]] = [
        exec_dict[act_id]
        for act_id in unresolved_fuzzy_ids
        if act_id in exec_dict
    ]

    def _get_work_desc(act: Dict[str, Any]) -> str:
        raw_vals = act.get("original_record", {}).get("raw_values", {})
        raw_unm = act.get("original_record", {}).get("unmapped_attributes", {})
        return str(
            raw_vals.get("Work Description")
            or raw_unm.get("Work Description")
            or act.get("work_description")
            or ""
        ).strip()

    # Pre-build schedule context documents
    sched_docs = [
        build_context_document(
            name=s.get("activity_name"),
            work_desc=s.get("activity_name"),
            discipline=s.get("discipline"),
            wbs=s.get("wbs")
        )
        for s in schedule_activities
    ]

    # Pre-build execution context documents with rich work descriptions
    exec_docs = [
        build_context_document(
            name=e.get("activity_name"),
            work_desc=_get_work_desc(e),
            discipline=e.get("discipline"),
            wbs=e.get("wbs")
        )
        for e in unresolved_execution
    ]

    # Compute TF-IDF vectors across all contextual documents
    all_docs = exec_docs + sched_docs
    all_vectors = compute_tfidf_vectors(all_docs)

    num_exec = len(exec_docs)
    exec_vectors = all_vectors[:num_exec]
    sched_vectors = all_vectors[num_exec:]

    semantic_results: List[Dict[str, Any]] = []
    possible_matches_count = 0
    no_match_count = 0

    for idx, exec_act in enumerate(unresolved_execution):
        exec_vec = exec_vectors[idx] if idx < len(exec_vectors) else {}
        exec_id = exec_act.get("activity_id")
        exec_name = exec_act.get("activity_name") or ""
        exec_discipline = exec_act.get("discipline") or "General"

        best_candidate: Optional[Dict[str, Any]] = None
        best_score = 0.0

        for sched_idx, sched_act in enumerate(schedule_activities):
            sched_vec = sched_vectors[sched_idx] if sched_idx < len(sched_vectors) else {}
            score = cosine_similarity(exec_vec, sched_vec)
            if score > best_score:
                best_score = score
                best_candidate = sched_act

        rounded_score = round(best_score, 4)
        pct_str = f"{int(round(rounded_score * 100))}%"

        if best_score >= threshold and best_candidate:
            possible_matches_count += 1
            semantic_results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id,
                "execution_activity_name": exec_name,
                "execution_discipline": exec_discipline,
                "suggested_schedule_activity_id": best_candidate.get("activity_id"),
                "suggested_schedule_activity_name": best_candidate.get("activity_name"),
                "suggested_schedule_level": best_candidate.get("level"),
                "suggested_discipline": best_candidate.get("discipline") or exec_discipline,
                "similarity_score": rounded_score,
                "similarity_percentage": pct_str,
                "match_type": "semantic",
                "match_status": "possible_match"
            })
        else:
            no_match_count += 1
            semantic_results.append({
                "index": idx + 1,
                "execution_activity_id": exec_id,
                "execution_activity_name": exec_name,
                "execution_discipline": exec_discipline,
                "suggested_schedule_activity_id": best_candidate.get("activity_id") if best_candidate else None,
                "suggested_schedule_activity_name": best_candidate.get("activity_name") if best_candidate else None,
                "suggested_schedule_level": best_candidate.get("level") if best_candidate else None,
                "suggested_discipline": best_candidate.get("discipline") if best_candidate else exec_discipline,
                "similarity_score": rounded_score,
                "similarity_percentage": pct_str,
                "match_type": "semantic",
                "match_status": "unmatched"
            })

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "threshold": threshold,
        "unresolved_execution_count": len(semantic_results),
        "possible_semantic_matches": possible_matches_count,
        "no_match_count": no_match_count,
        "matches": semantic_results
    }


def resolve_activity_granularity(
    execution_activity: Dict[str, Any],
    candidate_schedule_activity: Optional[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]]
) -> tuple[str, str]:
    """
    Feature 2.10: Deterministic Granularity Resolution engine.
    Determines whether a field execution activity is represented at the correct
    schedule granularity (L5 or L6), and identifies when an execution record appears
    to represent a broader parent activity or a more detailed child activity.

    Rules:
    1. Direct L6 schedule activity match -> "L6"
    2. Direct L5 schedule activity match with L6 children under WBS -> "L5_PARENT"
    3. Direct L5 schedule activity match with NO L6 children -> "L5"
    4. Execution activity is more detailed than available schedule activity -> "DETAILED"
    5. Cannot be determined -> "UNKNOWN"
    """
    if not candidate_schedule_activity:
        return (
            "UNKNOWN",
            "No matching schedule candidate found to determine hierarchy granularity."
        )

    sched_level = str(candidate_schedule_activity.get("level") or "").upper().strip()
    sched_wbs = str(candidate_schedule_activity.get("wbs") or "").strip()

    # Extract execution WBS from direct or raw fields
    raw_vals = execution_activity.get("original_record", {}).get("raw_values", {})
    raw_unm = execution_activity.get("original_record", {}).get("unmapped_attributes", {})
    exec_wbs = str(
        execution_activity.get("wbs")
        or raw_vals.get("WBS")
        or raw_unm.get("WBS")
        or ""
    ).strip()

    if sched_level == "L6":
        # Check if execution WBS indicates a deeper sub-task beyond L6
        if exec_wbs and sched_wbs and exec_wbs != "-" and sched_wbs != "-":
            if exec_wbs.startswith(sched_wbs + ".") and len(exec_wbs.split(".")) > len(sched_wbs.split(".")):
                return (
                    "DETAILED",
                    f"Execution activity WBS ({exec_wbs}) is a detailed sub-task under schedule L6 WBS ({sched_wbs})."
                )
        return (
            "L6",
            "Direct match to Level 6 detailed task."
        )

    elif sched_level == "L5":
        # Check if schedule contains L6 children under this candidate's WBS
        child_l6_count = 0
        if sched_wbs and sched_wbs != "-":
            prefix = sched_wbs + "."
            for s in schedule_activities:
                s_wbs = str(s.get("wbs") or "").strip()
                s_lvl = str(s.get("level") or "").upper().strip()
                if s_lvl == "L6" and s_wbs.startswith(prefix):
                    child_l6_count += 1

        if child_l6_count > 0:
            return (
                "L5_PARENT",
                f"Execution activity maps to L5 summary work package while {child_l6_count} specific L6 child activities exist under WBS {sched_wbs}."
            )
        else:
            return (
                "L5",
                "Direct match to Level 5 work package with no child L6 activities."
            )

    return (
        "UNKNOWN",
        f"Schedule activity has unrecognized level '{sched_level}'."
    )


def resolve_all_granularities(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.10: Evaluates granularity for all execution activities based on
    candidates identified across Exact ID, Fuzzy, and Semantic matching tiers.
    """
    # 1. Exact ID Matching
    exact_res = match_exact_id(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    exact_matched_map = {
        m["execution_activity_id"]: m
        for m in exact_res["matches"]
        if m.get("match_status") == "matched"
    }

    # 2. Fuzzy Matching
    fuzzy_res = match_fuzzy_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    fuzzy_matched_map = {
        m["execution_activity_id"]: m
        for m in fuzzy_res["matches"]
        if m.get("match_status") == "possible_match"
    }

    # 3. Semantic Matching
    semantic_res = match_semantic_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    semantic_matched_map = {
        m["execution_activity_id"]: m
        for m in semantic_res["matches"]
        if m.get("match_status") == "possible_match"
    }

    # Index schedule activities by activity_id
    sched_lookup: Dict[str, Dict[str, Any]] = {}
    for s in schedule_activities:
        sid = normalize_id(s.get("activity_id"))
        if sid:
            sched_lookup[sid] = s

    results: List[Dict[str, Any]] = []
    l5_count = 0
    l6_count = 0
    l5_parent_count = 0
    detailed_count = 0
    unknown_count = 0

    for idx, exec_act in enumerate(execution_activities):
        exec_id = exec_act.get("activity_id")
        exec_name = exec_act.get("activity_name") or ""
        norm_exec_id = normalize_id(exec_id)

        candidate_sched: Optional[Dict[str, Any]] = None
        match_tier: Optional[str] = None

        # Tier 1: Check Exact Match
        if exec_id in exact_matched_map:
            exact_info = exact_matched_map[exec_id]
            sched_id = normalize_id(exact_info.get("schedule_activity_id"))
            candidate_sched = sched_lookup.get(sched_id)
            match_tier = "exact_id"
        # Tier 2: Check Fuzzy Match
        elif exec_id in fuzzy_matched_map:
            fuzzy_info = fuzzy_matched_map[exec_id]
            sched_id = normalize_id(fuzzy_info.get("suggested_schedule_activity_id"))
            candidate_sched = sched_lookup.get(sched_id)
            match_tier = "fuzzy"
        # Tier 3: Check Semantic Match
        elif exec_id in semantic_matched_map:
            sem_info = semantic_matched_map[exec_id]
            sched_id = normalize_id(sem_info.get("suggested_schedule_activity_id"))
            candidate_sched = sched_lookup.get(sched_id)
            match_tier = "semantic"

        # Resolve Granularity
        granularity_status, granularity_reason = resolve_activity_granularity(
            execution_activity=exec_act,
            candidate_schedule_activity=candidate_sched,
            schedule_activities=schedule_activities
        )

        # Count categories
        if granularity_status == "L6":
            l6_count += 1
        elif granularity_status == "L5_PARENT":
            l5_parent_count += 1
        elif granularity_status == "L5":
            l5_count += 1
        elif granularity_status == "DETAILED":
            detailed_count += 1
        else:
            unknown_count += 1

        # Extract execution WBS
        raw_vals = exec_act.get("original_record", {}).get("raw_values", {})
        raw_unm = exec_act.get("original_record", {}).get("unmapped_attributes", {})
        exec_wbs = str(
            exec_act.get("wbs")
            or raw_vals.get("WBS")
            or raw_unm.get("WBS")
            or "-"
        ).strip()

        results.append({
            "index": idx + 1,
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "matched_schedule_activity_id": candidate_sched.get("activity_id") if candidate_sched else None,
            "matched_schedule_activity_name": candidate_sched.get("activity_name") if candidate_sched else None,
            "matched_schedule_level": candidate_sched.get("level") if candidate_sched else None,
            "execution_wbs": exec_wbs if exec_wbs else "-",
            "schedule_wbs": (candidate_sched.get("wbs") if candidate_sched else None) or "-",
            "granularity_status": granularity_status,
            "granularity_reason": granularity_reason,
            "candidate_tier": match_tier or "none"
        })

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_evaluated": len(results),
        "l5_count": l5_count,
        "l6_count": l6_count,
        "l5_parent_count": l5_parent_count,
        "detailed_count": detailed_count,
        "unknown_count": unknown_count,
        "results": results
    }


def discover_new_activity(
    execution_activity: Dict[str, Any],
    exact_match: Optional[Dict[str, Any]] = None,
    fuzzy_match: Optional[Dict[str, Any]] = None,
    semantic_match: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Feature 2.11: Deterministic New Activity Discovery logic for a single execution activity.
    Uses existing matching cascade:
    1. Exact Match -> EXISTING_ACTIVITY (EXACT)
    2. Fuzzy Possible Match -> POSSIBLE_EXISTING_ACTIVITY (FUZZY)
    3. Semantic Possible Match -> POSSIBLE_EXISTING_ACTIVITY (SEMANTIC)
    4. Unresolved remainder:
       Inspects descriptive evidence (activity_id, activity_name, work_description, discipline, wbs, quantity, unit, status).
       If activity name or meaningful work description exists -> NEW_ACTIVITY_CANDIDATE (NONE).
       If missing both -> UNKNOWN (NONE).
    """
    exec_id = execution_activity.get("activity_id")
    exec_name = (execution_activity.get("activity_name") or "").strip()
    discipline = execution_activity.get("discipline") or "General"

    raw_vals = execution_activity.get("original_record", {}).get("raw_values", {})
    raw_unm = execution_activity.get("original_record", {}).get("unmapped_attributes", {})

    work_desc = str(
        raw_vals.get("Work Description")
        or raw_unm.get("Work Description")
        or execution_activity.get("work_description")
        or ""
    ).strip()

    exec_wbs = str(
        execution_activity.get("wbs")
        or raw_vals.get("WBS")
        or raw_unm.get("WBS")
        or "-"
    ).strip()

    planned_qty = execution_activity.get("planned_quantity") or raw_vals.get("Planned Qty") or raw_vals.get("Planned Quantity")
    actual_qty = execution_activity.get("actual_quantity") or raw_vals.get("Actual Qty") or raw_vals.get("Actual Quantity")
    unit = execution_activity.get("unit") or raw_vals.get("Unit") or "-"
    status = execution_activity.get("status") or raw_vals.get("Status") or "Not Started"

    # Collect available evidence fields
    evidence_fields = []
    if exec_id:
        evidence_fields.append("activity_id")
    if exec_name:
        evidence_fields.append("activity_name")
    if work_desc and work_desc.lower() not in ("none", "null", ""):
        evidence_fields.append("work_description")
    if discipline and discipline.lower() not in ("none", "null", "-", "general"):
        evidence_fields.append("discipline")
    if exec_wbs and exec_wbs != "-":
        evidence_fields.append("wbs")
    if planned_qty is not None:
        evidence_fields.append("planned_quantity")
    if actual_qty is not None:
        evidence_fields.append("actual_quantity")
    if unit and unit != "-":
        evidence_fields.append("unit")
    if status:
        evidence_fields.append("status")

    # Step 1: Check Exact Match
    if exact_match and exact_match.get("match_status") == "matched":
        return {
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "work_description": work_desc if work_desc else None,
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "status": status,
            "discovery_status": "EXISTING_ACTIVITY",
            "candidate_tier": "EXACT",
            "new_activity_reason": f"Corresponds to confirmed baseline schedule activity '{exact_match.get('schedule_activity_id')}' via exact ID matching.",
            "evidence_fields": evidence_fields,
            "matched_schedule_activity_id": exact_match.get("schedule_activity_id"),
            "matched_schedule_activity_name": exact_match.get("schedule_activity_name")
        }

    # Step 2: Check Fuzzy Match
    if fuzzy_match and fuzzy_match.get("match_status") == "possible_match":
        return {
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "work_description": work_desc if work_desc else None,
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "status": status,
            "discovery_status": "POSSIBLE_EXISTING_ACTIVITY",
            "candidate_tier": "FUZZY",
            "new_activity_reason": f"Potential match to baseline activity '{fuzzy_match.get('suggested_schedule_activity_id')}' ({fuzzy_match.get('similarity_percentage')} similarity). Not eligible for new activity proposal.",
            "evidence_fields": evidence_fields,
            "matched_schedule_activity_id": fuzzy_match.get("suggested_schedule_activity_id"),
            "matched_schedule_activity_name": fuzzy_match.get("suggested_schedule_activity_name")
        }

    # Step 3: Check Semantic Match
    if semantic_match and semantic_match.get("match_status") == "possible_match":
        return {
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "work_description": work_desc if work_desc else None,
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "status": status,
            "discovery_status": "POSSIBLE_EXISTING_ACTIVITY",
            "candidate_tier": "SEMANTIC",
            "new_activity_reason": f"Contextually similar to baseline activity '{semantic_match.get('suggested_schedule_activity_id')}' ({semantic_match.get('similarity_percentage')} TF-IDF similarity). Not eligible for new activity proposal.",
            "evidence_fields": evidence_fields,
            "matched_schedule_activity_id": semantic_match.get("suggested_schedule_activity_id"),
            "matched_schedule_activity_name": semantic_match.get("suggested_schedule_activity_name")
        }

    # Step 4: Unresolved activity - evaluate descriptive evidence for new activity proposal
    has_meaningful_name = bool(exec_name and exec_name.lower() not in ("unnamed", "none", "null", "-", "activity"))
    has_meaningful_desc = bool(work_desc and work_desc.lower() not in ("none", "null", "-", ""))

    if has_meaningful_name or has_meaningful_desc:
        reasons = []
        if has_meaningful_name:
            reasons.append(f"activity name '{exec_name}'")
        if has_meaningful_desc:
            reasons.append(f"work description '{work_desc}'")
        if discipline and discipline != "General":
            reasons.append(f"discipline '{discipline}'")

        evidence_str = ", ".join(reasons)
        return {
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "work_description": work_desc if work_desc else None,
            "discipline": discipline,
            "execution_wbs": exec_wbs,
            "planned_quantity": planned_qty,
            "actual_quantity": actual_qty,
            "unit": unit,
            "status": status,
            "discovery_status": "NEW_ACTIVITY_CANDIDATE",
            "candidate_tier": "NONE",
            "new_activity_reason": f"Unresolved across all matching tiers (Exact, Fuzzy, Semantic). Contains verified field evidence ({evidence_str}) representing scope not found in baseline schedule.",
            "evidence_fields": evidence_fields,
            "matched_schedule_activity_id": None,
            "matched_schedule_activity_name": None
        }

    return {
        "execution_activity_id": exec_id,
        "execution_activity_name": exec_name,
        "work_description": work_desc if work_desc else None,
        "discipline": discipline,
        "execution_wbs": exec_wbs,
        "planned_quantity": planned_qty,
        "actual_quantity": actual_qty,
        "unit": unit,
        "status": status,
        "discovery_status": "UNKNOWN",
        "candidate_tier": "NONE",
        "new_activity_reason": "Unresolved activity lacks sufficient descriptive evidence (missing both activity name and work description) to propose as a new schedule activity candidate.",
        "evidence_fields": evidence_fields,
        "matched_schedule_activity_id": None,
        "matched_schedule_activity_name": None
    }


def discover_new_activities(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = ""
) -> Dict[str, Any]:
    """
    Feature 2.11: Evaluates all execution activities across the matching hierarchy
    (Exact ID -> Fuzzy -> Context/Semantic) and identifies proposed New Activity Candidates.
    """
    # 1. Exact Matching
    exact_res = match_exact_id(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    exact_map = {
        m["execution_activity_id"]: m
        for m in exact_res.get("matches", [])
        if m.get("match_status") == "matched"
    }

    # 2. Fuzzy Matching
    fuzzy_res = match_fuzzy_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    fuzzy_map = {
        m["execution_activity_id"]: m
        for m in fuzzy_res.get("matches", [])
        if m.get("match_status") == "possible_match"
    }

    # 3. Semantic Matching
    semantic_res = match_semantic_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    semantic_map = {
        m["execution_activity_id"]: m
        for m in semantic_res.get("matches", [])
        if m.get("match_status") == "possible_match"
    }

    results: List[Dict[str, Any]] = []
    existing_count = 0
    possible_existing_count = 0
    new_candidate_count = 0
    unknown_count = 0

    for idx, exec_act in enumerate(execution_activities):
        exec_id = exec_act.get("activity_id")
        exact_item = exact_map.get(exec_id)
        fuzzy_item = fuzzy_map.get(exec_id)
        semantic_item = semantic_map.get(exec_id)

        discovery_record = discover_new_activity(
            execution_activity=exec_act,
            exact_match=exact_item,
            fuzzy_match=fuzzy_item,
            semantic_match=semantic_item
        )
        discovery_record["index"] = idx + 1

        d_status = discovery_record["discovery_status"]
        if d_status == "EXISTING_ACTIVITY":
            existing_count += 1
        elif d_status == "POSSIBLE_EXISTING_ACTIVITY":
            possible_existing_count += 1
        elif d_status == "NEW_ACTIVITY_CANDIDATE":
            new_candidate_count += 1
        else:
            unknown_count += 1

        results.append(discovery_record)

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_evaluated": len(results),
        "existing_activity_count": existing_count,
        "possible_existing_count": possible_existing_count,
        "new_activity_candidate_count": new_candidate_count,
        "unknown_count": unknown_count,
        "results": results
    }


def calculate_confidence_score(
    candidate_tier: str,
    similarity_score: Optional[float] = None,
    granularity_status: Optional[str] = None,
    discovery_status: Optional[str] = None
) -> tuple[float, int, str]:
    """
    Feature 2.12: Computes deterministic confidence score (0.0 to 1.0),
    confidence percentage (0 to 100), and transparent confidence basis.

    Rules:
    - EXACT: confidence = 1.0 (100%), basis: "Exact activity ID match"
    - FUZZY: confidence = existing fuzzy similarity score, basis explains score vs 90% threshold
    - SEMANTIC: confidence = existing semantic similarity score, basis explains score vs 90% threshold
    - NEW_ACTIVITY_CANDIDATE: confidence = 0.0 (0%), basis: "New activity candidate requires planner validation"
    - UNKNOWN: confidence = 0.0 (0%), basis: "Unresolved activity with insufficient information requires planner review"
    """
    tier = (candidate_tier or "").upper().strip()
    d_status = (discovery_status or "").upper().strip()

    if tier == "EXACT" or d_status == "EXISTING_ACTIVITY":
        basis = "Exact activity ID match"
        if granularity_status in ("L5", "L6", "L5_PARENT"):
            basis += f" with verified {granularity_status} schedule hierarchy"
        return 1.0, 100, basis

    if tier == "FUZZY":
        score = float(similarity_score if similarity_score is not None else 0.0)
        pct = int(round(score * 100))
        if score >= 0.90:
            basis = f"Fuzzy activity similarity score ({pct}% >= 90% auto-accept threshold)"
        else:
            basis = f"Fuzzy activity similarity score ({pct}% < 90% auto-accept threshold)"
        return score, pct, basis

    if tier == "SEMANTIC":
        score = float(similarity_score if similarity_score is not None else 0.0)
        pct = int(round(score * 100))
        if score >= 0.90:
            basis = f"Context/semantic similarity score ({pct}% >= 90% auto-accept threshold)"
        else:
            basis = f"Context/semantic similarity score ({pct}% < 90% auto-accept threshold)"
        return score, pct, basis

    if d_status == "NEW_ACTIVITY_CANDIDATE":
        return 0.0, 0, "New activity candidate requires planner validation"

    return 0.0, 0, "Unresolved activity with insufficient information requires planner review"


def classify_validation_status(
    candidate_tier: str,
    confidence_score: float,
    discovery_status: Optional[str] = None,
    auto_accept_threshold: float = 0.90
) -> str:
    """
    Feature 2.12: Classifies validation status as either AUTO_ACCEPT or PLANNER_REVIEW.

    Rules:
    - EXACT ID MATCH -> AUTO_ACCEPT
    - FUZZY POSSIBLE MATCH with confidence >= auto_accept_threshold (0.90) -> AUTO_ACCEPT
    - SEMANTIC POSSIBLE MATCH with confidence >= auto_accept_threshold (0.90) -> AUTO_ACCEPT
    - All others (confidence < 0.90, NEW_ACTIVITY_CANDIDATE, UNKNOWN) -> PLANNER_REVIEW
    """
    tier = (candidate_tier or "").upper().strip()
    d_status = (discovery_status or "").upper().strip()

    # New activity candidates and unknowns always require planner review
    if d_status in ("NEW_ACTIVITY_CANDIDATE", "UNKNOWN") or tier in ("NONE", ""):
        return "PLANNER_REVIEW"

    # Exact matches are safe for automatic acceptance classification
    if tier == "EXACT":
        return "AUTO_ACCEPT"

    # Fuzzy and semantic candidates must meet the strict auto-accept confidence threshold (0.90)
    if tier in ("FUZZY", "SEMANTIC"):
        if confidence_score >= auto_accept_threshold:
            return "AUTO_ACCEPT"
        return "PLANNER_REVIEW"

    return "PLANNER_REVIEW"


def calculate_validation_results(
    execution_activities: List[Dict[str, Any]],
    schedule_activities: List[Dict[str, Any]],
    execution_filename: str = "",
    schedule_filename: str = "",
    auto_accept_threshold: float = 0.90
) -> Dict[str, Any]:
    """
    Feature 2.12: Ingests pipeline results across Exact ID, Fuzzy, Semantic,
    Granularity Resolution, and New Activity Discovery, computing deterministic
    confidence scores and validation classifications without modifying databases or schedules.
    """
    # 1. Pipeline: Granularity Resolution (contains match tiers, matched schedules, granularity)
    granularity_res = resolve_all_granularities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    granularity_map = {
        r["execution_activity_id"]: r
        for r in granularity_res.get("results", [])
    }

    # 2. Pipeline: New Activity Discovery (contains discovery statuses)
    discovery_res = discover_new_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    discovery_map = {
        r["execution_activity_id"]: r
        for r in discovery_res.get("results", [])
    }

    # 3. Pipeline: Fuzzy matching scores for similarity lookup
    fuzzy_res = match_fuzzy_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    fuzzy_score_map = {
        m["execution_activity_id"]: m.get("similarity_score", 0.0)
        for m in fuzzy_res.get("matches", [])
    }

    # 4. Pipeline: Semantic matching scores for similarity lookup
    semantic_res = match_semantic_activities(
        execution_activities=execution_activities,
        schedule_activities=schedule_activities,
        threshold=0.70,
        execution_filename=execution_filename,
        schedule_filename=schedule_filename
    )
    semantic_score_map = {
        m["execution_activity_id"]: m.get("similarity_score", 0.0)
        for m in semantic_res.get("matches", [])
    }

    results: List[Dict[str, Any]] = []
    auto_accept_count = 0
    planner_review_count = 0
    total_confidence = 0.0

    for idx, exec_act in enumerate(execution_activities):
        exec_id = exec_act.get("activity_id")
        exec_name = exec_act.get("activity_name") or ""
        discipline = exec_act.get("discipline") or "General"

        gran_record = granularity_map.get(exec_id, {})
        disc_record = discovery_map.get(exec_id, {})

        # Determine candidate tier from discovery / granularity record
        raw_tier = disc_record.get("candidate_tier") or gran_record.get("candidate_tier") or "NONE"
        tier_upper = str(raw_tier).upper()
        if "EXACT" in tier_upper:
            candidate_tier = "EXACT"
        elif "FUZZY" in tier_upper:
            candidate_tier = "FUZZY"
        elif "SEMANTIC" in tier_upper:
            candidate_tier = "SEMANTIC"
        else:
            candidate_tier = "NONE"

        discovery_status = disc_record.get("discovery_status") or "UNKNOWN"
        granularity_status = gran_record.get("granularity_status") or "UNKNOWN"

        matched_sched_id = disc_record.get("matched_schedule_activity_id") or gran_record.get("matched_schedule_activity_id")
        matched_sched_name = disc_record.get("matched_schedule_activity_name") or gran_record.get("matched_schedule_activity_name")

        # Determine similarity score based on tier
        if candidate_tier == "EXACT":
            sim_score = 1.0
        elif candidate_tier == "FUZZY":
            sim_score = fuzzy_score_map.get(exec_id, 0.0)
        elif candidate_tier == "SEMANTIC":
            sim_score = semantic_score_map.get(exec_id, 0.0)
        else:
            sim_score = 0.0

        # Calculate confidence score, percentage, and basis
        conf_score, conf_pct, conf_basis = calculate_confidence_score(
            candidate_tier=candidate_tier,
            similarity_score=sim_score,
            granularity_status=granularity_status,
            discovery_status=discovery_status
        )

        # Classify validation status
        val_status = classify_validation_status(
            candidate_tier=candidate_tier,
            confidence_score=conf_score,
            discovery_status=discovery_status,
            auto_accept_threshold=auto_accept_threshold
        )

        if val_status == "AUTO_ACCEPT":
            auto_accept_count += 1
        else:
            planner_review_count += 1

        total_confidence += conf_score

        # Extract execution WBS
        raw_vals = exec_act.get("original_record", {}).get("raw_values", {})
        raw_unm = exec_act.get("original_record", {}).get("unmapped_attributes", {})
        exec_wbs = str(
            exec_act.get("wbs")
            or raw_vals.get("WBS")
            or raw_unm.get("WBS")
            or "-"
        ).strip()

        results.append({
            "index": idx + 1,
            "execution_activity_id": exec_id,
            "execution_activity_name": exec_name,
            "discipline": discipline,
            "execution_wbs": exec_wbs if exec_wbs else "-",
            "candidate_tier": candidate_tier,
            "matched_schedule_activity_id": matched_sched_id,
            "matched_schedule_activity_name": matched_sched_name,
            "granularity_status": granularity_status,
            "discovery_status": discovery_status,
            "confidence_score": round(conf_score, 4),
            "confidence_percentage": conf_pct,
            "validation_status": val_status,
            "confidence_basis": conf_basis
        })

    total_evaluated = len(results)
    avg_confidence = round(total_confidence / total_evaluated, 4) if total_evaluated > 0 else 0.0

    return {
        "execution_file": execution_filename,
        "schedule_file": schedule_filename,
        "total_evaluated": total_evaluated,
        "auto_accept_count": auto_accept_count,
        "planner_review_count": planner_review_count,
        "average_confidence": avg_confidence,
        "auto_accept_threshold": auto_accept_threshold,
        "results": results
    }

