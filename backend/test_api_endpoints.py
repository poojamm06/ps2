"""
NAWI TRUST — FastAPI Live Endpoints Test Suite
"""
import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api():
    print("=== Testing GET /api/health ===")
    res = client.get("/api/health")
    print(f"Status: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "NAWI TRUST API"}

    print("\n=== Testing GET /api/health/database ===")
    res = client.get("/api/health/database")
    print(f"Status: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 200
    assert res.json()["database"] == "connected"
    assert res.json()["query_result"] == 1

    print("\n=== Testing GET /api/instruments ===")
    res = client.get("/api/instruments")
    print(f"Status: {res.status_code}, Count: {len(res.json())}, First: {res.json()[0]['model']}")
    assert res.status_code == 200

    print("\n=== Testing GET /api/sessions ===")
    res = client.get("/api/sessions")
    print(f"Status: {res.status_code}, Count: {len(res.json())}, First Code: {res.json()[0]['session_code']}")
    assert res.status_code == 200

    print("\n=== Testing POST /api/compliance/calculate ===")
    payload = {
        "reference_value": 500.0,
        "indicated_value": 500.2,
        "mpe": 0.5
    }
    res = client.post("/api/compliance/calculate", json=payload)
    print(f"Status: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 200
    assert res.json()["error"] == 0.2
    assert res.json()["result"] == "PASS"

    print("\n=== Testing GET /api/compliance/session/1 ===")
    res = client.get("/api/compliance/session/1")
    print(f"Status: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 200
    assert res.json()["overall_result"] == "PASS"

    print("\n>>> ALL API ENDPOINT TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_api()
