import httpx

client = httpx.Client(base_url="http://localhost:8000")

print("=== Case A: Valid PASS ===")
res_a = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.2,
    "mpe": 0.5,
    "test_type": "weighing_performance"
}).json()
print("Case A Result:", res_a)
assert res_a["result"] == "PASS"
assert res_a["error"] == 0.2

print("\n=== Case B: Valid FAIL ===")
res_b = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.8,
    "mpe": 0.5,
    "test_type": "weighing_performance"
}).json()
print("Case B Result:", res_b)
assert res_b["result"] == "FAIL"
assert res_b["error"] == 0.8

print("\n=== Case C: Invalid Input ===")
# Missing or negative mpe
res_c = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.2,
    "mpe": -0.5
})
print("Case C Status & Response:", res_c.status_code, res_c.json())
assert res_c.status_code == 422 or res_c.json().get("result") == "INVALID"

print("\n=== Case D: Unsupported/Unverified Rule (e.g. eccentricity) ===")
res_d = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.2,
    "mpe": 0.5,
    "test_type": "eccentricity"
}).json()
print("Case D Result:", res_d)
assert res_d["result"] == "NOT_IMPLEMENTED"
assert "Clause 3.6.2" in res_d["clause"]

print("\n=== Case E: Boundary Condition (|E| == MPE) ===")
res_e = client.post("/api/compliance/calculate", json={
    "reference_value": 500.0,
    "indicated_value": 500.5,
    "mpe": 0.5,
    "test_type": "weighing_performance"
}).json()
print("Case E Result:", res_e)
assert res_e["result"] == "PASS"
assert res_e["error"] == 0.5

print("\n>>> ALL 5 API TEST CASES PASSED OVER HTTP! <<<")
