from app.api.ingestion import get_fuzzy_matches, get_exact_id_matches

def run_tests():
    print("=== Feature 2.8 Verification Tests ===")

    # First inspect exact matches
    exact_res = get_exact_id_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx')
    exact_matched_ids = {m['execution_activity_id'] for m in exact_res['matches'] if m['match_status'] == 'matched'}
    print(f"Feature 2.7 Exact Matched IDs: {exact_matched_ids}")

    # Now inspect fuzzy matches
    fuzzy_res = get_fuzzy_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx', threshold=0.70)
    fuzzy_matches = fuzzy_res['matches']

    print(f"\nFuzzy Candidate Count (Unmatched by Exact ID): {fuzzy_res['unmatched_execution_count']}")
    print(f"Possible Fuzzy Matches (>= 0.70): {fuzzy_res['possible_fuzzy_matches']}")
    print(f"No Match Found (< 0.70): {fuzzy_res['no_match_count']}")

    # 1. Verify exact matches are strictly excluded from fuzzy matches
    for fm in fuzzy_matches:
        exec_id = fm['execution_activity_id']
        assert exec_id not in exact_matched_ids, f"ERROR: Exact matched activity {exec_id} found in fuzzy results!"
    print("\nTEST 1 PASSED: Exact matches are strictly excluded from fuzzy results (zero duplication).")

    matches_by_id = {m['execution_activity_id']: m for m in fuzzy_matches}

    # 2. Verify FUZ-L6-01 produces possible_match with score >= 0.70
    fuz_item = matches_by_id.get('FUZ-L6-01')
    assert fuz_item is not None, "FUZ-L6-01 not found in fuzzy results"
    print(f"\nFUZ-L6-01 Execution: '{fuz_item['execution_activity_name']}'")
    print(f"Suggested Schedule: '{fuz_item['suggested_schedule_activity_name']}' ({fuz_item['suggested_schedule_activity_id']})")
    print(f"Similarity Score: {fuz_item['similarity_score']} ({fuz_item['similarity_percentage']})")
    print(f"Match Status: {fuz_item['match_status']} | Match Type: {fuz_item['match_type']}")
    assert fuz_item['match_status'] == 'possible_match', f"Expected possible_match, got {fuz_item['match_status']}"
    assert fuz_item['similarity_score'] >= 0.70, f"Expected score >= 0.70, got {fuz_item['similarity_score']}"
    assert fuz_item['match_type'] == 'fuzzy'
    print("TEST 2 PASSED: FUZ-L6-01 -> possible_match (score >= 0.70).")

    # 3. Verify UNM-99-99 produces unmatched with score < 0.70
    unm_item = matches_by_id.get('UNM-99-99')
    assert unm_item is not None, "UNM-99-99 not found in fuzzy results"
    print(f"\nUNM-99-99 Execution: '{unm_item['execution_activity_name']}'")
    print(f"Suggested Schedule: '{unm_item['suggested_schedule_activity_name']}' ({unm_item['suggested_schedule_activity_id']})")
    print(f"Similarity Score: {unm_item['similarity_score']} ({unm_item['similarity_percentage']})")
    print(f"Match Status: {unm_item['match_status']} | Match Type: {unm_item['match_type']}")
    assert unm_item['match_status'] == 'unmatched', f"Expected unmatched, got {unm_item['match_status']}"
    assert unm_item['similarity_score'] < 0.70, f"Expected score < 0.70, got {unm_item['similarity_score']}"
    print("TEST 3 PASSED: UNM-99-99 -> unmatched (score < 0.70).")

    print("\nALL FEATURE 2.8 BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
