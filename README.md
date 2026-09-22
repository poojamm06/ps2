# NAWI TRUST
### Intelligent Metrological Verification & Statutory Compliance Platform for Non-Automatic Weighing Instruments (NAWI)

NAWI TRUST is a full-stack, domain-accurate platform built for Legal Metrology Officers, Verification Laboratories, and NAWI Manufacturers. It provides end-to-end statutory verification adhering to **OIML R-76-1:2006** (International Organization of Legal Metrology) standards, digital evidence tracking, metrological fingerprinting, and statistical anomaly intelligence.

---

## 🚀 Live System URLs

| Service | URL | Description |
|---|---|---|
| **Frontend Application** | [http://localhost:5173](http://localhost:5173) | Interactive React + Vite Dashboard & Verification Workspace |
| **Backend REST API** | [http://localhost:8000](http://localhost:8000) | FastAPI Engine with PostgreSQL ORM |
| **Interactive OpenAPI Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI for testing all API endpoints |
| **Database Engine** | `postgresql://localhost:5432/nawi_trust` | PostgreSQL live persistence layer |

---

## 🏛️ Core Architecture & Domain Features

### 1. Deterministic OIML R-76:2006 Compliance Engine
- **Table 6 MPE Tiers**: Real mathematical evaluation based on scale interval $e$ and accuracy classes:
  - **Class I (Special)**: $0 \le m \le 50\,000e$ ($\pm 0.5e$), $\le 200\,000e$ ($\pm 1.0e$), $> 200\,000e$ ($\pm 1.5e$)
  - **Class II (High)**: $0 \le m \le 5\,000e$ ($\pm 0.5e$), $\le 20\,000e$ ($\pm 1.0e$), $> 20\,000e$ ($\pm 1.5e$)
  - **Class III (Medium)**: $0 \le m \le 500e$ ($\pm 0.5e$), $\le 2\,000e$ ($\pm 1.0e$), $> 2\,000e$ ($\pm 1.5e$)
  - **Class IV (Ordinary)**: $0 \le m \le 50e$ ($\pm 0.5e$), $\le 200e$ ($\pm 1.0e$), $> 200e$ ($\pm 1.5e$)
- **Statutory In-Service Multiplier**: Automatically applies the statutory $2\times \text{MPE}$ multiplier for in-service verifications versus initial verifications.

### 2. Live PostgreSQL Persistence Layer
- All verification records, instruments, test point observations, evidence metadata, fingerprints, and audit trails are persisted in relational tables:
  - `instruments`, `test_sessions`, `readings`, `evidence_items`, `compliance_results`, `audit_logs`, `fingerprints`, `software_verifications`, `anomaly_results`.

### 3. Empirical Metrological Fingerprinting
- Computes empirical error characteristics across verification loads:
  - Mean error ($\mu$), standard deviation ($\sigma$), linear regression slope ($m$), $R^2$ determination coefficient.
  - Generates SHA-256 integrity seal ensuring non-repudiation of observations.

### 4. Metrological Anomaly Intelligence
- **Statutory Separation**: Clearly delineated from deterministic OIML R-76 statutory compliance.
- Analyzes error distribution using **Z-score** ($Z > 2.5$) and **Interquartile Range (IQR)** fences to flag potential calibration drift, environmental shock, or non-linear sensor anomalies.

### 5. WELMEC 7.2 Software Verification (Prototype)
- Verifies legally-relevant software identity, cryptographic checksum comparison against certified baselines, protected calibration parameters, and audit trails.

### 6. Official Digital Reports
- Direct generation of **ReportLab PDF Certificates** and **Editable Microsoft Word DOCX Reports** streamed directly from PostgreSQL verification sessions.

---

## 📋 Step-by-Step Manual Verification Guide

To test the entire workflow in your browser:

### Step 1: Open the Frontend & Login
1. Navigate to **[http://localhost:5173](http://localhost:5173)**.
2. Click **"Demo Officer Login"** (or use any email).
3. Verify that the **PostgreSQL Indicator** in the top navigation is **Green / Connected**.
4. Observe the live KPI cards on the **Dashboard** (total instruments, active sessions, real compliance distribution chart).

### Step 2: Select or Create a Verification Session
1. In the sidebar, click **"Verification Sessions"** or click **"+ Start New Session"**.
2. Notice the auto-generated unique session code (e.g. `TS-2026-XXXX`).
3. Select an existing instrument (or enter custom parameters) and click **"Save & Sync Session"** to persist to PostgreSQL.

### Step 3: Data Acquisition (Test Point Readings)
1. Navigate to **"Data Acquisition"** in the sidebar.
2. Review existing recorded test points.
3. Enter a manual test point (e.g. Reference Load `500.0 g`, Indicated Value `500.2 g`) and click **"Add Reading & Evaluate MPE"**.
4. Observe automatic OIML R-76 MPE evaluation ($\pm 0.5000\text{ g}$ $\rightarrow$ `PASS`).

### Step 4: OIML Compliance Evaluation
1. Navigate to **"OIML Compliance"** in the sidebar.
2. Review the full observation table showing each test point, its OIML clause reference (e.g., `cl. 3.5.1`), load in $e$ (e.g., `5000e`), and MPE utilisation percentage.
3. Use the interactive single-test calculation sandbox to verify boundary conditions.

### Step 5: Metrological Fingerprint
1. Navigate to **"Metrological Fingerprint"** in the sidebar.
2. Observe the dynamic **Linearity Chart** plotting observed error against upper/lower statutory MPE limits.
3. Review the empirical error statistics (Mean, Std Dev, $R^2$, Trend Classification) and the SHA-256 seal.

### Step 6: WELMEC Software Verification
1. Navigate to **"WELMEC Software"** in the sidebar.
2. If software is applicable, enter software ID, installed firmware hash, and baseline hash.
3. Click **"Save Software Record"** to verify checksum match and persist the record.

### Step 7: Anomaly Intelligence
1. Navigate to **"Anomaly Intelligence"** in the sidebar.
2. Click **"Run Analysis"** to execute the Z-score and IQR anomaly detection engine on session readings.
3. Review the statistical classification (`NORMAL`, `ATTENTION`, or `ANOMALY`), outlier flags, and statutory advisory notice.

### Step 8: Digital Certificate & Report Generation
1. Navigate to **"Digital Reports"** in the sidebar.
2. Review the official verification certificate with conforming/non-conforming verdict banner.
3. Click **"Download PDF"** to stream the official ReportLab PDF certificate.
4. Click **"Editable DOCX"** to download the Microsoft Word test report.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Chart.js, Lucide/Material Symbols.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy ORM, Uvicorn.
- **Database**: PostgreSQL with relational schema and ACID transactions.
- **Document Generation**: ReportLab (PDF) & python-docx (DOCX).
- **Metrology Engine**: Deterministic implementation of OIML R-76-1:2006 (E).
