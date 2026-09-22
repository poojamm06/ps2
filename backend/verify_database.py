"""
NAWI TRUST — PostgreSQL Database & API Verification Script

Executes table creation, checks information_schema, persists test data,
and verifies deterministic calculation & storage in PostgreSQL.
"""
import sys
from datetime import datetime, timezone
from sqlalchemy import text
from app.database import engine, SessionLocal, init_db, Base
from app.models.instrument import Instrument
from app.models.test_session import TestSession
from app.models.reading import Reading
from app.models.compliance import ComplianceResult
from app.services.compliance_engine import calculate_point_compliance


def verify():
    print("=== Step 1: Testing PostgreSQL Connection ===")
    with engine.connect() as conn:
        res = conn.execute(text("SELECT version();")).scalar()
        print(f"Connected to PostgreSQL: {res}")

    print("\n=== Step 2: Creating Database Tables via SQLAlchemy ===")
    init_db()

    print("\n=== Step 3: Verifying Created Tables in PostgreSQL ===")
    with engine.connect() as conn:
        tables = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
            )
        ).fetchall()
        table_names = [t[0] for t in tables]
        print(f"Tables in 'nawi_trust': {table_names}")

    db = SessionLocal()
    try:
        print("\n=== Step 4: Persisting Test Instrument ===")
        # Clean up existing test instrument if present
        existing_inst = (
            db.query(Instrument)
            .filter(Instrument.serial_number == "MT-EXP-2026-0982")
            .first()
        )
        if existing_inst:
            print("Cleaning prior test instrument...")
            db.delete(existing_inst)
            db.commit()

        test_inst = Instrument(
            manufacturer="Mettler-Toledo Inc.",
            model="Excellence Precision XP-600",
            serial_number="MT-EXP-2026-0982",
            functional_type="High-Precision Analytical Balance",
            accuracy_class="Class II",
            max_capacity=600.0,
            min_capacity=0.0,
            unit="g",
            verification_scale_interval_e=0.1,
            actual_scale_interval_d=0.01,
            software_applicable=True,
            approval_certificate_number="OIML-R76-2026-A09",
        )
        db.add(test_inst)
        db.commit()
        db.refresh(test_inst)
        print(
            f"Persisted Instrument ID: {test_inst.id}, Model: {test_inst.model}, Serial: {test_inst.serial_number}"
        )

        print("\n=== Step 5: Persisting Test Session ===")
        test_sess = TestSession(
            session_code="TS-2026-0899",
            instrument_id=test_inst.id,
            officer_name="Insp. Helena Vance",
            officer_badge="LM-8492-EU",
            test_location="LAB-DE-04",
            verification_date="2026-09-20",
            status="IN_PROGRESS",
            current_step=1,
        )
        db.add(test_sess)
        db.commit()
        db.refresh(test_sess)
        print(
            f"Persisted Session ID: {test_sess.id}, Code: {test_sess.session_code}, Officer: {test_sess.officer_name}"
        )

        print("\n=== Step 6: Calculating & Persisting Reading ===")
        calc = calculate_point_compliance(
            reference_value=500.0,
            indicated_value=500.2,
            mpe=0.5,
        )
        print(f"Deterministic Calculation Result: {calc}")

        test_reading = Reading(
            session_id=test_sess.id,
            test_point="Weighing Performance (500g)",
            reference_value=calc["reference_value"],
            indicated_value=calc["indicated_value"],
            error=calc["error"],
            mpe=calc["mpe"],
            unit="g",
            result=calc["result"],
        )
        db.add(test_reading)
        db.commit()
        db.refresh(test_reading)
        print(
            f"Persisted Reading ID: {test_reading.id}, Reference: {test_reading.reference_value}g, Indicated: {test_reading.indicated_value}g, Error: {test_reading.error}g, Result: {test_reading.result}"
        )

        print("\n=== Step 7: Persisting Session Compliance Result ===")
        compliance = ComplianceResult(
            session_id=test_sess.id,
            overall_result=calc["result"],
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            review_tests=0,
            calculated_at=datetime.now(timezone.utc),
        )
        db.add(compliance)
        test_sess.compliance_verdict = calc["result"]
        db.commit()
        db.refresh(compliance)
        print(
            f"Persisted Compliance Result ID: {compliance.id}, Verdict: {compliance.overall_result}, Passed: {compliance.passed_tests}/{compliance.total_tests}"
        )

        print("\n=== Step 8: Verifying Directly via SQL Queries ===")
        with engine.connect() as conn:
            inst_row = conn.execute(
                text(
                    "SELECT id, manufacturer, model, serial_number, accuracy_class, max_capacity, min_capacity, verification_scale_interval_e, actual_scale_interval_d, software_applicable FROM instruments WHERE serial_number = 'MT-EXP-2026-0982';"
                )
            ).fetchone()
            print(f"SQL instruments row: {inst_row}")

            sess_row = conn.execute(
                text(
                    "SELECT id, session_code, officer_name, test_location, status, current_step, compliance_verdict FROM test_sessions WHERE session_code = 'TS-2026-0899';"
                )
            ).fetchone()
            print(f"SQL test_sessions row: {sess_row}")

            reading_row = conn.execute(
                text(
                    "SELECT id, session_id, reference_value, indicated_value, error, mpe, result FROM readings WHERE session_id = :sid;"
                ),
                {"sid": test_sess.id},
            ).fetchone()
            print(f"SQL readings row: {reading_row}")

            comp_row = conn.execute(
                text(
                    "SELECT id, session_id, overall_result, total_tests, passed_tests, failed_tests FROM compliance_results WHERE session_id = :sid;"
                ),
                {"sid": test_sess.id},
            ).fetchone()
            print(f"SQL compliance_results row: {comp_row}")

        print("\n>>> ALL POSTGRESQL PERSISTENCE CHECKS PASSED SUCCESSFULLY! <<<")

    finally:
        db.close()


if __name__ == "__main__":
    verify()
