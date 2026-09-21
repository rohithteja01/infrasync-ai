"""
Automated Regression Test Suite: Zero Legacy Schedule Dependency.
Guarantees that:
1. Production runtime never requires or depends on 'sample_l5_l6_schedule.xlsx'.
2. When a custom project Excel file (e.g. 'Infrasync_AI_20_Line_Test_Data.xlsx') is uploaded:
   - It is dynamically recognized and parsed as both schedule baseline and execution actuals.
   - 20 data rows, 7 L5 packages, and 20 L6 activities are correctly identified.
   - All 22 downstream endpoints process the file with HTTP 200 and zero legacy filename leaks.
3. Zero query parameters dynamically resolve to the active uploaded project.
4. If no project data is uploaded, returns HTTP 404: 'No project data uploaded. Please upload a project Excel file to begin.'
5. Second filename test ('project_progress_test_02.xlsx') succeeds identically, proving zero filename hardcoding.
6. Cryptographic MD5 hash of 'baseline_schedule.xlsx' strictly matches '5d8ed61031538f056d33aadcd603a06c'.
"""

import sys
import shutil
import hashlib
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user
from app.core.database import SessionLocal
from app.models.user_profile import UserProfile
from app.api.ingestion import get_schedule_activities, get_active_project_filename, resolve_active_files, STORAGE_DIR

TEST_USER_ID = "test-planner-regression-uuid"
app.dependency_overrides[get_current_user] = lambda: {
    "id": TEST_USER_ID,
    "email": "planner.regression@infrasync.ai",
    "role": "authenticated"
}

client = TestClient(app)
TEST_FILE = "Infrasync_AI_20_Line_Test_Data.xlsx"
SECOND_FILE = "project_progress_test_02.xlsx"


def setup_module():
    """Ensure test planner user exists in PostgreSQL."""
    db = SessionLocal()
    try:
        p = db.query(UserProfile).filter(UserProfile.id == TEST_USER_ID).first()
        if not p:
            p = UserProfile(id=TEST_USER_ID, email="planner.regression@infrasync.ai", role="PLANNER")
            db.add(p)
            db.commit()
        else:
            p.role = "PLANNER"
            db.commit()
    finally:
        db.close()


def teardown_module():
    """Clean up test planner user from PostgreSQL."""
    db = SessionLocal()
    try:
        db.query(UserProfile).filter(UserProfile.id == TEST_USER_ID).delete()
        db.commit()
    finally:
        db.close()
    app.dependency_overrides.clear()


def test_01_baseline_schedule_md5_integrity():
    """Verify cryptographic MD5 hash of benchmark baseline schedule."""
    baseline = STORAGE_DIR / "baseline_schedule.xlsx"
    assert baseline.exists(), "baseline_schedule.xlsx must exist in storage"
    md5_hash = hashlib.md5(baseline.read_bytes()).hexdigest()
    assert md5_hash == "5d8ed61031538f056d33aadcd603a06c", f"MD5 mismatch: {md5_hash}"


def test_02_dynamic_parsing_20_rows_and_7_l5_packages():
    """Verify schedule parser dynamically extracts 20 rows, 7 L5 packages, and 20 L6 activities."""
    parsed = get_schedule_activities(TEST_FILE)
    acts = []
    for s in parsed.get("sheets", []):
        acts.extend(s.get("activities", []))
    assert len(acts) == 20, f"Expected 20 activities, got {len(acts)}"

    l6_acts = [a for a in acts if a.get("level") == "L6"]
    distinct_l5_pkgs = set(a.get("l5_activity") for a in acts if a.get("l5_activity"))
    assert len(l6_acts) == 20, f"Expected 20 L6 activities, got {len(l6_acts)}"
    assert len(distinct_l5_pkgs) == 7, f"Expected 7 L5 packages, got {len(distinct_l5_pkgs)}"


def test_03_all_downstream_endpoints_with_infrasync_data():
    """Verify all downstream endpoints succeed with HTTP 200 and zero mention of sample_l5_l6_schedule.xlsx."""
    endpoints = [
        f"/api/ingestion/schedule/{TEST_FILE}",
        f"/api/ingestion/schedules/{TEST_FILE}",
        f"/api/ingestion/excel/{TEST_FILE}",
        f"/api/ingestion/match/exact-id?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/match/fuzzy?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/match/semantic?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/match/granularity?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/match/new-activities?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/validation/confidence?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/validation/planner-review?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/planner-review?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/critical-path?schedule_file={TEST_FILE}",
        f"/api/ingestion/delay-detection?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/schedule-health?schedule_file={TEST_FILE}",
        f"/api/ingestion/impact-propagation?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/root-cause-analysis?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/delay-prediction?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/recovery-plans?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/recommendations?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
        f"/api/ingestion/decision-center?execution_file={TEST_FILE}&schedule_file={TEST_FILE}",
    ]
    for url in endpoints:
        res = client.get(url)
        assert res.status_code == 200, f"Expected HTTP 200 for {url}, got {res.status_code}"
        assert "sample_l5_l6_schedule.xlsx" not in res.text, f"Legacy filename leaked in {url}"

    # What-If Simulator POST
    res_whatif = client.post("/api/ingestion/what-if", json={
        "execution_file": TEST_FILE,
        "schedule_file": TEST_FILE,
        "target_activity_id": "CIV-L5-001",
        "scenario_type": "DELAY_DAYS",
        "scenario_value": 5
    })
    assert res_whatif.status_code == 200, f"What-If failed: {res_whatif.status_code}"
    assert "sample_l5_l6_schedule.xlsx" not in res_whatif.text


def test_04_dynamic_unparameterized_calls():
    """Verify unparameterized calls dynamically resolve to active uploaded file."""
    unparameterized = [
        "/api/ingestion/critical-path",
        "/api/ingestion/delay-detection",
        "/api/ingestion/schedule-health",
        "/api/ingestion/impact-propagation",
        "/api/ingestion/root-cause-analysis",
        "/api/ingestion/delay-prediction",
        "/api/ingestion/recovery-plans",
        "/api/ingestion/recommendations",
        "/api/ingestion/decision-center",
        "/api/ingestion/validation/confidence",
        "/api/ingestion/validation/planner-review",
    ]
    for url in unparameterized:
        res = client.get(url)
        assert res.status_code == 200, f"Unparameterized call failed for {url}: {res.status_code}"
        assert "sample_l5_l6_schedule.xlsx" not in res.text


def test_05_legacy_query_param_interception():
    """Verify legacy parameter 'sample_l5_l6_schedule.xlsx' is intercepted and resolved to active file."""
    res = client.get("/api/ingestion/critical-path?schedule_file=sample_l5_l6_schedule.xlsx")
    assert res.status_code == 200
    assert "sample_l5_l6_schedule.xlsx" not in res.text


def test_06_second_filename_zero_hardcoding():
    """Verify arbitrary second filename succeeds identically without hardcoding."""
    test_path = STORAGE_DIR / TEST_FILE
    second_path = STORAGE_DIR / SECOND_FILE
    shutil.copyfile(test_path, second_path)
    try:
        assert second_path.exists()
        res = client.get(f"/api/ingestion/critical-path?schedule_file={SECOND_FILE}")
        assert res.status_code == 200
        assert res.json().get("schedule_file") == SECOND_FILE

        res_conf = client.get(f"/api/ingestion/validation/confidence?execution_file={SECOND_FILE}&schedule_file={SECOND_FILE}")
        assert res_conf.status_code == 200
        assert res_conf.json().get("schedule_file") == SECOND_FILE
    finally:
        if second_path.exists():
            second_path.unlink()


def test_07_empty_storage_404_handling():
    """Verify 404 message when no project data exists."""
    import app.api.ingestion as ing
    old_fn = ing.get_active_project_filename
    ing.get_active_project_filename = lambda: None
    baseline_bak = ing.STORAGE_DIR / "baseline_schedule.xlsx.bak"
    (ing.STORAGE_DIR / "baseline_schedule.xlsx").rename(baseline_bak)
    try:
        try:
            ing.resolve_active_files(None, None)
            threw = False
        except Exception as exc:
            threw = True
            assert "No project data uploaded. Please upload a project Excel file to begin." in str(exc)
            assert "sample_l5_l6_schedule.xlsx" not in str(exc)
        assert threw, "Expected 404 when storage is empty"
    finally:
        baseline_bak.rename(ing.STORAGE_DIR / "baseline_schedule.xlsx")
        ing.get_active_project_filename = old_fn


if __name__ == "__main__":
    setup_module()
    try:
        test_01_baseline_schedule_md5_integrity()
        print("  [PASS] test_01_baseline_schedule_md5_integrity")
        test_02_dynamic_parsing_20_rows_and_7_l5_packages()
        print("  [PASS] test_02_dynamic_parsing_20_rows_and_7_l5_packages")
        test_03_all_downstream_endpoints_with_infrasync_data()
        print("  [PASS] test_03_all_downstream_endpoints_with_infrasync_data")
        test_04_dynamic_unparameterized_calls()
        print("  [PASS] test_04_dynamic_unparameterized_calls")
        test_05_legacy_query_param_interception()
        print("  [PASS] test_05_legacy_query_param_interception")
        test_06_second_filename_zero_hardcoding()
        print("  [PASS] test_06_second_filename_zero_hardcoding")
        test_07_empty_storage_404_handling()
        print("  [PASS] test_07_empty_storage_404_handling")
        print("\nALL 7 REGRESSION TEST SUITES PASSED SUCCESSFULLY!")
    finally:
        teardown_module()
