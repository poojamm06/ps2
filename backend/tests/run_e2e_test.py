import httpx
import json
import time

def run_test():
    client = httpx.Client(base_url="http://127.0.0.1:8000")

    print("=== 1. INSTRUMENT REGISTRATION / LOOKUP ===")
    instruments = client.get("/api/instruments").json()
    xp600 = next((i for i in instruments if i["serial_number"] == "MT-EXP-2026-0982"), None)

    if not xp600:
        inst_payload = {
            "manufacturer": "Mettler-Toledo Inc.",
            "model": "Excellence Precision XP-600",
            "serial_number": "MT-EXP-2026-0982",
            "functional_type": "High-Precision Analytical Balance",
            "accuracy_class": "II",
            "max_capacity": 600.0,
            "min_capacity": 0.0,
            "unit": "g",
            "verification_scale_interval_e": 0.1,
            "actual_scale_interval_d": 0.01,
            "software_applicable": True,
            "approval_certificate_number": "DE-PTB-2026-0982",
        }
        r = client.post("/api/instruments", json=inst_payload)
        print("Created instrument status:", r.status_code)
        xp600 = r.json()
    else:
        print("Found registered instrument:", xp600["id"], xp600["serial_number"])

    instrument_id = xp600["id"]

    print("\n=== 2. SESSION CREATION ===")
    session_code = f"TS-E2E-{int(time.time())}"
    session_payload = {
        "session_code": session_code,
        "instrument_id": instrument_id,
        "officer_name": "Insp. Helena Vance",
        "officer_badge": "DE-HV-492",
        "test_location": "LAB-DE-04",
        "verification_date": "2026-09-20",
        "status": "IN_PROGRESS",
        "current_step": 2,
    }
    r_sess = client.post("/api/sessions", json=session_payload)
    print("Created session status:", r_sess.status_code)
    session = r_sess.json()
    session_id = session["id"]
    print("Session ID:", session_id, "Code:", session["session_code"], "Station:", session["test_location"], "Officer:", session["officer_name"])

    print("\n=== 3. MANUAL DATA ACQUISITION (5 READINGS) ===")
    test_points = [
        ("Test Point 100g", 100.0, 100.1, 0.5),
        ("Test Point 200g", 200.0, 200.1, 0.5),
        ("Test Point 300g", 300.0, 300.2, 0.5),
        ("Test Point 400g", 400.0, 400.2, 0.5),
        ("Test Point 500g", 500.0, 500.3, 0.5),
    ]

    saved_readings = []
    for label, ref, ind, mpe in test_points:
        reading_payload = {
            "session_id": session_id,
            "test_point": label,
            "reference_value": ref,
            "indicated_value": ind,
            "mpe": mpe,
            "unit": "g",
        }
        r_read = client.post("/api/readings", json=reading_payload)
        print(f"Posted reading {ref}g -> {ind}g | Status: {r_read.status_code}")
        saved_readings.append(r_read.json())

    print("\n=== 4. POSTGRESQL PERSISTENCE VERIFICATION ===")
    r_all_readings = client.get(f"/api/readings/session/{session_id}")
    persisted_readings = r_all_readings.json()
    print("Total readings persisted in PostgreSQL for session", session_id, ":", len(persisted_readings))
    for idx, pr in enumerate(persisted_readings, 1):
        print(f"  #{idx} ID: {pr['id']}, Ref: {pr['reference_value']}g, Ind: {pr['indicated_value']}g, Error: {pr['error']:+.2f}g, MPE: +/-{pr['mpe']}g, Result: {pr['result']}")

    print("\n=== 5. COMPLIANCE EVALUATION ===")
    r_comp = client.post(f"/api/compliance/session/{session_id}/evaluate")
    print("Session compliance evaluation status:", r_comp.status_code)
    comp_res = r_comp.json()
    print("Compliance Result ID:", comp_res.get("id"))
    print("Overall Result:", comp_res.get("overall_result"))
    print("Total Tests:", comp_res.get("total_tests"))
    print("Passed Tests:", comp_res.get("passed_tests"))
    print("Failed Tests:", comp_res.get("failed_tests"))

    print("\n=== 6. METROLOGICAL FINGERPRINT GENERATION ===")
    r_fp = client.post(f"/api/fingerprint/session/{session_id}")
    print("Fingerprint generation status:", r_fp.status_code)
    fp_res = r_fp.json()
    print("Fingerprint Status:", fp_res.get("status"))
    print("Measurement Count:", fp_res.get("measurement_count"))
    print("Fingerprint Hash (SHA-256):", fp_res.get("fingerprint_hash"))
    print("Fingerprint Version:", fp_res.get("fingerprint_version"))
    print("Error Statistics:", json.dumps(fp_res.get("error_statistics"), indent=2))
    print("Trend Analysis:", json.dumps(fp_res.get("trend"), indent=2))
    print("Coverage:", json.dumps(fp_res.get("test_coverage"), indent=2))

    print("\n=== 7. INVALID INPUT REJECTION TEST ===")
    invalid_payload = {
        "session_id": session_id,
        "test_point": "Invalid Test Point",
        "reference_value": 500.0,
        "indicated_value": "abc",
        "mpe": 0.5,
        "unit": "g",
    }
    r_invalid = client.post("/api/readings", json=invalid_payload)
    print("Invalid payload response status:", r_invalid.status_code)
    print("Invalid payload error response:", r_invalid.text)

    r_after_invalid = client.get(f"/api/readings/session/{session_id}")
    print("Readings count after invalid attempt (must remain 5):", len(r_after_invalid.json()))

    print("\n=== 8. DATABASE DIRECT INTEGRITY CHECK ===")
    r_sess_check = client.get(f"/api/sessions/{session_id}")
    print("Session check:", r_sess_check.status_code, r_sess_check.json()["session_code"])
    r_fp_check = client.get(f"/api/fingerprint/session/{session_id}")
    print("Fingerprint check:", r_fp_check.status_code, r_fp_check.json()["fingerprint_hash"])

if __name__ == "__main__":
    run_test()
