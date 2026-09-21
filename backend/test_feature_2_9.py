from app.api.ingestion import get_exact_id_matches, get_fuzzy_matches, get_semantic_matches

def run_tests():
    print("=== Feature 2.9 Verification Tests ===")

    # 1. Exact matches from Feature 2.7
    exact_res = get_exact_id_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx')
    exact_matched_ids = {m['execution_activity_id'] for m in exact_res['matches'] if m['match_status'] == 'matched'}
    print(f"Feature 2.7 Exact Matched IDs (Must be excluded): {exact_matched_ids}")

    # 2. Fuzzy matches from Feature 2.8
    fuzzy_res = get_fuzzy_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx', threshold=0.70)
    fuzzy_matched_ids = {m['execution_activity_id'] for m in fuzzy_res['matches'] if m['match_status'] == 'possible_match'}
    print(f"Feature 2.8 Fuzzy Matched IDs (Must be excluded): {fuzzy_matched_ids}")

    # 3. Semantic matches from Feature 2.9
    sem_res = get_semantic_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx', threshold=0.70)
    sem_matches = sem_res['matches']

    print(f"\nUnresolved Execution Activities Entering Semantic Matching: {sem_res['unresolved_execution_count']}")
    print(f"Possible Semantic Matches (>= 0.70): {sem_res['possible_semantic_matches']}")
    print(f"No Match Found (< 0.70): {sem_res['no_match_count']}")

    # Condition 1: Verify Exact Matches never reach semantic matching
    for sm in sem_matches:
        exec_id = sm['execution_activity_id']
        assert exec_id not in exact_matched_ids, f"ERROR: Exact matched activity {exec_id} found in semantic results!"
    print("\nTEST 1 PASSED: Exact matches are strictly excluded from semantic matching.")

    # Condition 2: Verify Fuzzy Matches never reach semantic matching
    for sm in sem_matches:
        exec_id = sm['execution_activity_id']
        assert exec_id not in fuzzy_matched_ids, f"ERROR: Fuzzy matched activity {exec_id} found in semantic results!"
    print("TEST 2 PASSED: Fuzzy matches are strictly excluded from semantic matching.")

    matches_by_id = {m['execution_activity_id']: m for m in sem_matches}

    # Condition 3: Verify SEM-L6-01 produces possible_match with PIP-L6-03 (score >= 0.70)
    sem_item = matches_by_id.get('SEM-L6-01')
    assert sem_item is not None, "SEM-L6-01 not found in semantic results"
    print(f"\nSEM-L6-01 Execution: '{sem_item['execution_activity_name']}' ({sem_item['execution_discipline']})")
    print(f"Suggested Schedule: '{sem_item['suggested_schedule_activity_name']}' ({sem_item['suggested_schedule_activity_id']})")
    print(f"Similarity Score: {sem_item['similarity_score']} ({sem_item['similarity_percentage']})")
    print(f"Match Status: {sem_item['match_status']} | Match Type: {sem_item['match_type']}")
    assert sem_item['match_status'] == 'possible_match', f"Expected possible_match, got {sem_item['match_status']}"
    assert sem_item['suggested_schedule_activity_id'] == 'PIP-L6-03', f"Expected PIP-L6-03, got {sem_item['suggested_schedule_activity_id']}"
    assert sem_item['similarity_score'] >= 0.70, f"Expected score >= 0.70, got {sem_item['similarity_score']}"
    assert sem_item['match_type'] == 'semantic'
    print("TEST 3 PASSED: SEM-L6-01 -> possible_match with PIP-L6-03 (score >= 0.70).")

    # Condition 4: Verify UNM-99-99 produces unmatched (score < 0.70)
    unm_item = matches_by_id.get('UNM-99-99')
    assert unm_item is not None, "UNM-99-99 not found in semantic results"
    print(f"\nUNM-99-99 Execution: '{unm_item['execution_activity_name']}' ({unm_item['execution_discipline']})")
    print(f"Suggested Schedule: '{unm_item['suggested_schedule_activity_name']}' ({unm_item['suggested_schedule_activity_id']})")
    print(f"Similarity Score: {unm_item['similarity_score']} ({unm_item['similarity_percentage']})")
    print(f"Match Status: {unm_item['match_status']} | Match Type: {unm_item['match_type']}")
    assert unm_item['match_status'] == 'unmatched', f"Expected unmatched, got {unm_item['match_status']}"
    assert unm_item['similarity_score'] < 0.70, f"Expected score < 0.70, got {unm_item['similarity_score']}"
    print("TEST 4 PASSED: UNM-99-99 -> unmatched (score < 0.70).")

    # Condition 5 & 6: Verify semantic matches are marked possible_match, never confirmed
    for sm in sem_matches:
        assert sm['match_status'] in ('possible_match', 'unmatched')
        assert sm['match_status'] != 'matched', "Semantic matches must NEVER be marked confirmed 'matched'!"
    print("\nTEST 5 & 6 PASSED: Semantic matches are strictly marked 'possible_match', never auto-confirmed.")

    print("\nALL FEATURE 2.9 VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
