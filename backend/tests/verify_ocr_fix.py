import httpx
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test_ocr_fix():
    client = httpx.Client(base_url="http://127.0.0.1:8000")

    evd_list = client.get("/api/evidence/session/1").json()
    print(f"Total evidence items for session 1: {len(evd_list)}")

    for evd in evd_list:
        evd_id = evd["id"]
        fname = evd.get("file_name", "unknown")
        print(f"\n==========================================")
        print(f"Triggering OCR on Evidence Item #{evd_id} ({fname})")
        print(f"==========================================")
        r_ocr = client.post(f"/api/evidence/{evd_id}/ocr")
        print("OCR HTTP Status:", r_ocr.status_code)
        res = r_ocr.json()
        print("\n--- RAW OCR TEXT ---")
        print(res.get("ocr_raw_text"))
        print("\n--- EXTRACTED STRUCTURED FIELDS ---")
        for field, data in res.get("ocr_data", {}).items():
            val = data.get("value")
            st = data.get("status")
            conf = data.get("confidence")
            print(f"  {field:30s} -> {str(val):25s} [{st}] (conf: {conf}%)")

        print("\n--- CONSISTENCY VERDICT ---")
        print("Status:", res.get("consistency_status"))
        try:
            parsed_details = json.loads(res.get("consistency_details", "{}"))
            print("Summary:", parsed_details.get("summary"))
            print("Field Checks:")
            for chk in parsed_details.get("field_checks", []):
                print(f"  {chk.get('label'):25s}: Extracted '{chk.get('extracted')}' vs Registered '{chk.get('registered')}' -> {chk.get('status')}")
        except Exception:
            print("Details:", res.get("consistency_details"))

if __name__ == "__main__":
    test_ocr_fix()
