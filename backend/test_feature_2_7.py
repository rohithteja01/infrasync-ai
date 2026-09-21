from app.api.ingestion import get_exact_id_matches

def run_tests():
    res = get_exact_id_matches('test_execution_matches.xlsx', 'sample_l5_l6_schedule.xlsx')
    matches_by_exec_id = {m['execution_activity_id']: m for m in res['matches']}

    # Test 1: CIV-L6-01 -> MATCHED
    m1 = matches_by_exec_id.get('CIV-L6-01')
    assert m1 is not None, 'CIV-L6-01 missing'
    assert m1['match_status'] == 'matched', f"Expected matched, got {m1['match_status']}"
    assert m1['schedule_activity_id'] == 'CIV-L6-01'
    print(f"TEST 1 PASSED: CIV-L6-01 -> MATCHED (Schedule ID: {m1['schedule_activity_id']}, Level: {m1['schedule_level']})")

    # Test 2: UNM-99-99 -> UNMATCHED
    m2 = matches_by_exec_id.get('UNM-99-99')
    assert m2 is not None, 'UNM-99-99 missing'
    assert m2['match_status'] == 'unmatched', f"Expected unmatched, got {m2['match_status']}"
    assert m2['schedule_activity_id'] is None
    print("TEST 2 PASSED: UNM-99-99 -> UNMATCHED (Schedule ID is None)")

    # Test 3: CIV-L6-02 with different activity name -> MATCHED
    m3 = matches_by_exec_id.get('CIV-L6-02')
    assert m3 is not None, 'CIV-L6-02 missing'
    assert m3['match_status'] == 'matched', f"Expected matched, got {m3['match_status']}"
    assert m3['execution_activity_name'] == 'Rebar tying & formwork setup - Area A'
    assert m3['schedule_activity_name'] == 'Foundation rebar fixing and shuttering'
    assert m3['execution_activity_name'] != m3['schedule_activity_name']
    print(f"TEST 3 PASSED: CIV-L6-02 with different names -> MATCHED (Exec: \"{m3['execution_activity_name']}\" vs Sched: \"{m3['schedule_activity_name']}\")")

    print("\nSummary Counts:")
    print(f"Total Execution Activities: {res['total_execution_activities']}")
    print(f"Exact Matches: {res['exact_matches']}")
    print(f"Unmatched: {res['unmatched_activities']}")
    print("\nALL 3 CORE TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
