"""
Comprehensive End-to-End Verification Test Script
"""
import httpx
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.instrument import Instrument
from app.models.test_session import TestSession
from app.models.reading import Reading
from app.models.compliance import ComplianceResult

def run_tests():
    print("==================================================")
    print("1. POSTGRESQL CONNECTION")
    print("==================================================")
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1;")).scalar()
        version = conn.execute(text("SELECT version();")).scalar()
        db_name = conn.execute(text("SELECT current_database();")).scalar()
        print(f"Server: {version}")
        print(f"Database: {db_name}")
        print(f"SELECT 1 Query: {res} (PASS)" if res == 1 else f"SELECT 1 Query: FAIL ({res})")

    print("\n==================================================")
    print("2. DATABASE TABLES")
    print("==================================================")
    with engine.connect() as conn:
        tables = [t[0] for t in conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
        )).fetchall()]
        print(f"Actual tables found: {tables}")
        for t in ['instruments', 'test_sessions', 'readings', 'evidence_items', 'compliance_results', 'audit_logs']:
            print(f"  - {t}: {'PASS' if t in tables else 'FAIL'}")

    print("\n==================================================")
    print("3. FASTAPI HEALTH")
    print("==================================================")
    client = httpx.Client(base_url="http://localhost:8000")
    h = client.get("/api/health")
    print(f"GET /api/health -> Status: {h.status_code}, Response: {h.json()}")

    dbh = client.get("/api/health/database")
    print(f"GET /api/health/database -> Status: {dbh.status_code}, Response: {dbh.json()}")

    print("\n==================================================")
    print("4. DATABASE PERSISTENCE - INSTRUMENT")
    print("==================================================")
    inst_res = client.get("/api/instruments").json()
    matched_inst = next((i for i in inst_res if i["serial_number"] == "MT-EXP-2026-0982"), None)
    if not matched_inst:
        print("Creating instrument via API...")
        matched_inst = client.post("/api/instruments", json={
            "manufacturer": "Mettler-Toledo Inc.",
            "model": "Excellence Precision XP-600",
            "serial_number": "MT-EXP-2026-0982",
            "functional_type": "High-Precision Analytical Balance",
            "accuracy_class": "Class II",
            "max_capacity": 600.0,
            "min_capacity": 0.0,
            "unit": "g",
            "verification_scale_interval_e": 0.1,
            "actual_scale_interval_d": 0.01,
            "software_applicable": True,
            "approval_certificate_number": "OIML-R76-2026-A09"
        }).json()

    print(f"Instrument in API: ID={matched_inst['id']}, Serial={matched_inst['serial_number']}")
    with engine.connect() as conn:
        db_row = conn.execute(
            text("SELECT id, manufacturer, model, serial_number, accuracy_class, max_capacity, min_capacity, verification_scale_interval_e, actual_scale_interval_d, software_applicable FROM instruments WHERE serial_number = :sn;"),
            {"sn": "MT-EXP-2026-0982"}
        ).fetchone()
        print(f"Direct PostgreSQL Query: {db_row}")

    print("\n==================================================")
    print("5. TEST SESSION")
    print("==================================================")
    sessions = client.get("/api/sessions").json()
    matched_sess = next((s for s in sessions if s["session_code"] == "TS-2026-0899"), None)
    if not matched_sess:
        print("Creating session via API...")
        matched_sess = client.post("/api/sessions", json={
            "session_code": "TS-2026-0899",
            "instrument_id": matched_inst["id"],
            "officer_name": "Insp. Helena Vance",
            "officer_badge": "LM-8492-EU",
            "test_location": "LAB-DE-04",
            "verification_date": "2026-09-20",
            "status": "IN_PROGRESS",
            "current_step": 1
        }).json()

    print(f"Session in API: ID={matched_sess['id']}, Code={matched_sess['session_code']}, Officer={matched_sess['officer_name']}")
    with engine.connect() as conn:
        sess_db_row = conn.execute(
            text("SELECT id, session_code, officer_name, test_location, status, current_step FROM test_sessions WHERE session_code = 'TS-2026-0899';")
        ).fetchone()
        print(f"Direct PostgreSQL Query: {sess_db_row}")

    print("\n==================================================")
    print("6. READING TEST")
    print("==================================================")
    # Post a reading
    reading_res = client.post("/api/readings", json={
        "session_id": matched_sess["id"],
        "test_point": "Weighing Performance (500g)",
        "reference_value": 500.0,
        "indicated_value": 500.2,
        "mpe": 0.5,
        "unit": "g"
    }).json()
    print(f"Reading created via API: ID={reading_res['id']}, Ref={reading_res['reference_value']}, Ind={reading_res['indicated_value']}, Error={reading_res['error']}, MPE={reading_res['mpe']}, Result={reading_res['result']}")

    with engine.connect() as conn:
        rdg_db_row = conn.execute(
            text("SELECT id, session_id, reference_value, indicated_value, error, mpe, result FROM readings WHERE id = :rid;"),
            {"rid": reading_res["id"]}
        ).fetchone()
        print(f"Direct PostgreSQL Query: {rdg_db_row}")

    print("\n==================================================")
    print("7. COMPLIANCE TEST")
    print("==================================================")
    comp_calc = client.post("/api/compliance/calculate", json={
        "reference_value": 500.0,
        "indicated_value": 500.2,
        "mpe": 0.5
    }).json()
    print(f"Compliance Calculation endpoint: {comp_calc}")
    print(f"  - error: {comp_calc['error']} (expected: 0.2)")
    print(f"  - absolute error: {abs(comp_calc['error'])} (expected: 0.2)")
    print(f"  - condition: abs(error) <= MPE -> {abs(comp_calc['error'])} <= {comp_calc['mpe']} -> {comp_calc['result']}")

    # Session compliance evaluation and persistence in PostgreSQL
    comp_eval = client.post(f"/api/compliance/session/{matched_sess['id']}/evaluate").json()
    print(f"Session Compliance Evaluation endpoint: {comp_eval}")

    with engine.connect() as conn:
        comp_db_row = conn.execute(
            text("SELECT id, session_id, overall_result, total_tests, passed_tests, failed_tests FROM compliance_results WHERE session_id = :sid;"),
            {"sid": matched_sess["id"]}
        ).fetchone()
        print(f"Direct PostgreSQL Query: {comp_db_row}")

if __name__ == "__main__":
    run_tests()
