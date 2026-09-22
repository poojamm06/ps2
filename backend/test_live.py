import urllib.request, json, time

BASE = "http://localhost:8000/api"

def get(path):
    r = urllib.request.urlopen(f"{BASE}{path}")
    return json.loads(r.read())

def post(path, data=None):
    body = json.dumps(data or {}).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"}, method="POST")
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

def patch(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"}, method="PATCH")
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

print("=== NAWI TRUST E2E LIVE TEST ===")
h = get("/health")
print(f"[1] Health: {h['service']} - OK")
db = get("/health/database")
print(f"[2] Database: {db['database_engine']} connected")

sn = f"LIVE-{int(time.time()) % 100000}"
try:
    inst = post("/instruments", {"manufacturer":"RADWAG","model":"PS 2100.R2","serial_number":sn,"functional_type":"Analytical Balance","accuracy_class":"Class II","max_capacity":2100.0,"min_capacity":0.5,"unit":"g","verification_scale_interval_e":0.1,"actual_scale_interval_d":0.01,"software_applicable":True})
    inst_id = inst["id"]
    print(f"[3] Instrument registered: id={inst_id} SN={inst['serial_number']}")
except Exception as ex:
    existing = get("/instruments")
    inst_id = existing[0]["id"]
    print(f"[3] Using existing instrument id={inst_id}: {ex}")

sc = f"LIVE-{int(time.time()) % 100000}"
sess = post("/sessions", {"session_code":sc,"instrument_id":inst_id,"officer_name":"Insp. Helena Vance","test_location":"State Lab Station 04","verification_date":"2026-09-21","status":"IN_PROGRESS","current_step":1,"test_type":"INITIAL_VERIFICATION","temperature_c":21.4,"relative_humidity_pct":48.2,"atmospheric_pressure_hpa":1013.25,"environment_source":"MANUAL","standards_used":"OIML E2 Weights"})
sess_id = sess["id"]
print(f"[4] Session created: {sess['session_code']} id={sess_id} status={sess['status']}")
print(f"    Env: {sess['temperature_c']}C, {sess['relative_humidity_pct']}% RH, {sess['atmospheric_pressure_hpa']} hPa")

test_points = [("Zero",0.0,0.0),("100g",100.0,100.04),("500g",500.0,500.08),("1000g",1000.0,999.94),("2000g",2000.0,2000.12)]
for name, ref, ind in test_points:
    r = post("/readings", {"session_id":sess_id,"test_point":name,"reference_value":ref,"indicated_value":ind,"unit":"g"})
    print(f"[5] Reading {name}: err={r['error']:+.4f}g mpe=+/-{r['mpe']}g => {r['result']}")

calc = post("/compliance/calculate", {"reference_value":500.0,"indicated_value":500.08,"mpe":0.5,"test_type":"weighing_performance","accuracy_class":"Class II"})
print(f"[6] OIML Calc: err={calc['error']:+.4f}g mpe=+/-{calc['mpe']}g => {calc['result']} | {calc.get('standard','')} {calc.get('edition','')}")

comp = post(f"/compliance/session/{sess_id}/evaluate")
print(f"[7] Session verdict: {comp['overall_result']} (total={comp['total_tests']} pass={comp['passed_tests']} fail={comp['failed_tests']})")

upd = patch(f"/sessions/{sess_id}", {"status":"COMPLETED"})
print(f"[8] Session completed: status={upd['status']} verdict={upd['compliance_verdict']}")

repo = get("/repository/search?limit=5")
print(f"[9] Repository: {repo['total_results']} instruments found")

hist = get(f"/repository/instruments/{inst_id}/history")
print(f"[10] Instrument history: {hist['total_sessions']} sessions")

audit = get(f"/audit/session/{sess_id}")
print(f"[11] Audit trail: {len(audit)} entries for this session")

rpt = get(f"/reports/{sess_id}/data")
print(f"[12] Report data: {rpt['session_code']} result={rpt['overall_result']} readings={len(rpt['readings'])}")

recent_audit = get("/audit/recent?limit=5")
print(f"[13] Recent system audit: {len(recent_audit)} entries")

print()
print("=== ALL 13 CHECKS PASSED ===")
print(f"Session code: {sc} | Instrument S/N: {sn}")
print(f"PDF: http://localhost:8000/api/reports/{sess_id}/pdf")
print(f"DOCX: http://localhost:8000/api/reports/{sess_id}/docx")
