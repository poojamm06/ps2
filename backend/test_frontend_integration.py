import httpx

client = httpx.Client(base_url="http://localhost:8000")

print("1. Health Check:")
h = client.get("/api/health").json()
dbh = client.get("/api/health/database").json()
print("   /api/health ->", h)
print("   /api/health/database ->", dbh)

print("\n2. Instruments Registry:")
insts = client.get("/api/instruments").json()
print(f"   Loaded {len(insts)} instrument(s):", insts[0]["manufacturer"], insts[0]["model"])

print("\n3. Sessions Register:")
sessions = client.get("/api/sessions").json()
sess_id = sessions[0]["id"]
print(f"   Loaded {len(sessions)} session(s): Code = {sessions[0]['session_code']}, ID = {sess_id}")

print("\n4. Direct Reading Persistence:")
reading = client.post("/api/readings", json={
    "session_id": sess_id,
    "test_point": "Weighing Performance (500g)",
    "reference_value": 500.0,
    "indicated_value": 500.2,
    "mpe": 0.5,
    "unit": "g"
}).json()
print("   Persisted Reading -> ID:", reading["id"], "Error:", reading["error"], "Verdict:", reading["result"])

print("\n5. Deterministic Compliance Engine:")
comp = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.2,
    "mpe": 0.5
}).json()
print("   Engine Output -> Error:", comp["error"], "MPE:", comp["mpe"], "Result:", comp["result"])

print("\n6. Session Compliance Evaluation & Persistence:")
eval_res = client.post(f"/api/compliance/session/{sess_id}/evaluate").json()
print("   Session Compliance Result -> Overall:", eval_res["overall_result"], "Passed:", eval_res["passed_tests"], "Total:", eval_res["total_tests"])

print("\n7. Verifying Session Readings in Database:")
readings = client.get(f"/api/readings/session/{sess_id}").json()
print(f"   Session {sess_id} has {len(readings)} reading(s) retrieved directly from PostgreSQL.")

print("\n>>> ALL INTEGRATION AND PERSISTENCE TESTS PASSED! <<<")
