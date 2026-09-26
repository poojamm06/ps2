# NAWI TRUST

**NAWI TRUST** is a metrological verification and digital trust platform developed for **Smart India Hackathon 2026 (Problem Statement: SIH26054)**. It automates testing, compliance evaluation, digital evidence management, and certificate generation for **Non-Automatic Weighing Instruments (NAWIs)** in strict accordance with the international standard **OIML R 76-1:2006 / OIML R 76-2:2007**. The system replaces error-prone paper inspection sheets with an integrated, tamper-evident digital workflow backed by PostgreSQL.

---

## Problem Statement

- **SIH Problem Statement**: **SIH26054**
- **Domain**: Legal Metrology & Standards / Verification of Non-Automatic Weighing Instruments
- **Core Challenges**:
  - **Manual Data Handling**: Metrological type-evaluation and statutory verifications rely on paper logs and static spreadsheets, creating high vulnerability to transcription and calculation errors.
  - **Compliance Inconsistencies**: Manual calculation of Maximum Permissible Error (MPE) thresholds across multiple accuracy classes and load ranges leads to inconsistent enforcement of OIML standards.
  - **Weak Traceability & Evidence Gaps**: Verification records often lack cryptographic linkage between test readings, physical nameplate photos, environmental conditions, and final inspection certificates.
  - **Software Integrity Blindspots**: Modern digital weighing instruments run legally relevant software, yet inspectors often lack structured tools to verify firmware versions and checksum baselines against approved type approvals.

NAWI TRUST solves these challenges by combining automated OIML R 76 calculations, dual-engine OCR evidence validation, statistical metrological fingerprinting, tamper-evident audit logging, and automated certificate generation into a unified platform.

---

## Key Capabilities

Every capability listed below is implemented and functional in the codebase:

- **Instrument Registration & Technical Profiles**:
  - Registers instruments with complete OIML metrological attributes: Accuracy Class (**Class I**, **Class II**, **Class III**, **Class IV**), Maximum Capacity ($Max$), Minimum Capacity ($Min$), Verification Scale Interval ($e$), Actual Scale Interval ($d$), Unit of Measurement ($g$, $kg$, $t$, $mg$), Manufacturer, Model, Serial Number, Type Approval Certificate Number, and Legally Relevant Software applicability.

- **8-Step Verification Session Workflow**:
  - Structured, guided inspection lifecycle:
    1. *Setup & Laboratory Conditions* (binds instrument, officer badge, location, ambient environment)
    2. *Reference Standards* (standards identification and calibration validity)
    3. *Observations / Data Entry* (test load, indicated reading, tare, eccentricity position, repeatability runs)
    4. *Compliance Evaluation* (automated real-time OIML R 76 evaluation)
    5. *Physical Evidence Capture* (photographic evidence collection and OCR extraction)
    6. *Software Verification & Examination* (firmware hash validation and diagnostic simulation)
    7. *Metrological Fingerprint* (statistical profile derivation and SHA-256 hash generation)
    8. *Digital Report* (preview and export of official certificates)

- **Environmental & Laboratory Monitoring**:
  - Captures ambient conditions (Temperature in °C, Relative Humidity in %, Atmospheric Pressure in hPa) and reference standards used, persisting them into PostgreSQL and embedding them in statutory test certificates.

- **Deterministic OIML R 76 Compliance Engine**:
  - Implements authoritative formulas from OIML R 76-1:
    - Error of indication: $E = I - L$
    - Absolute error: $|E|$
    - Table 6 MPE limits ($0.5e$, $1.0e$, $1.5e$) determined dynamically based on accuracy class and applied load tier ($m/e$).
    - Supports both **Initial Verification** and **In-Service Verification** (with automatic $2 \times MPE$ tolerance scaling).
    - Calculates MPE capacity utilization percentage and produces statutory **PASS** / **FAIL** verdicts.

- **Physical Evidence Capture & OCR Consistency Validation**:
  - Stores uploaded photographic evidence categorized as *Nameplate*, *Inspection Seal*, *Display Readout*, or *Environmental Condition*.
  - **Dual-Engine OCR Pipeline**: Integrates **RapidOCR (ONNX)** with a fallback to **PyTesseract** (and a graceful simulated extraction fallback if OCR native binaries are not installed).
  - Performs automated metrological cross-validation between OCR-extracted parameters (Serial Number, Model, Max, $e$) and the instrument's registered specifications, highlighting confidence scores and flagging discrepancies.

- **Metrological Fingerprint (Statistical Identity)**:
  - Derives an instrument's unique statistical measurement profile from real test observations, computing mean error, standard deviation, drift rate, historical repeatability delta, and trend classification (*STABLE*, *INCREASING*, *DECREASING*, *IRREGULAR*).
  - Serializes and hashes the canonicalized feature vector with **SHA-256**, providing a tamper-evident digital identity for the instrument across verification cycles.

- **Statistical Anomaly Detection (Anomaly Intelligence)**:
  - Applies deterministic statistical anomaly scoring (Z-score and Interquartile Range / IQR evaluations) on measurement errors to flag abnormal drift, erratic repeatability, or excessive MPE utilization.
  - Provides advisory intelligence alerts (*NORMAL*, *ATTENTION*, *ANOMALY*) separate from statutory compliance.
  - *Note: This engine uses classical statistical methods and is not machine learning.*

- **Software Verification Record & Examination Terminal**:
  - OIML R 76 Clause 5.5 and WELMEC Guide 7.2 software verification tracking: records software ID, firmware version, declared checksum hash, and compares against approved type-approval baselines.
  - Features an interactive **Examination Terminal** running pre-authored command/response scenario scripts that simulate a diagnostic serial/USB interface inspection (clearly designated as a prototype demonstration harness).

- **Automated Digital Report Generation (PDF & DOCX)**:
  - Generates official OIML R 76 Verification Certificates and Inspection Summaries:
    - **PDF Generation**: Built with **ReportLab**, featuring bilingual layout headers, environmental tables, observation matrices, MPE charts, SHA-256 digital fingerprint digest, and a scannable verification QR code.
    - **DOCX Generation**: Built with **python-docx**, producing fully editable Microsoft Word documents for official reporting and archival.

- **Tamper-Evident Audit Ledger & Traceability**:
  - Maintains an append-only audit trail logging all metrological actions (session creation, reading entry, compliance evaluation, report generation).
  - Implements SHA-256 chain integrity verification to detect any ledger tampering, alongside RFC-4180 compliant CSV export (`NAWI_Audit_Ledger_YYYY-MM-DD.csv`).

- **Historical Repository & Search**:
  - Searchable, filterable digital archive of all completed and in-progress verification sessions with quick access to compliance records and report downloads.

- **Real-Time Metrological Dashboard**:
  - Interactive dashboard displaying live database statistics: total registered instruments, active verification sessions, overall compliance pass rate, statistical anomaly alerts, and real-time PostgreSQL connection health.

- **Session Continuity & State Persistence**:
  - Frontend `sessionStorage` synchronization ensures that browser reloads (F5) or accidental tab closures preserve the active session ID, test observations, and current workflow stage without data loss.

---

## System Architecture

NAWI TRUST is structured as a decoupled three-tier architecture:

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Browser)"]
        UI["React 19 + TypeScript + Ant Design"]
        State["VerificationContext + sessionStorage"]
        Charts["Chart.js Metrological Plots"]
        UI <--> State
        UI --> Charts
    end

    subgraph Server["Backend Service (FastAPI)"]
        API["FastAPI REST Router (/api)"]
        Auth["Lightweight RBAC & Middleware"]
        Compliance["OIML R 76 Compliance Engine"]
        OCR["Evidence & RapidOCR / Tesseract"]
        Fingerprint["Metrological Fingerprint Engine"]
        Anomaly["Statistical Anomaly Intelligence"]
        Reports["ReportLab (PDF) & python-docx (DOCX)"]
        Audit["Audit Ledger & SHA-256 Chain"]

        API --> Auth
        API --> Compliance
        API --> OCR
        API --> Fingerprint
        API --> Anomaly
        API --> Reports
        API --> Audit
    end

    subgraph Storage["Data Tier (PostgreSQL)"]
        DB[("PostgreSQL Database
        • instruments
        • test_sessions
        • readings
        • evidence
        • compliance_results
        • metrological_fingerprints
        • anomaly_results
        • software_verifications
        • audit_logs")]
    end

    Client -->|HTTP / JSON via REST| Server
    Server -->|SQLAlchemy 2.0 ORM + Psycopg 3| Storage
```

---

## Technology Stack

### Frontend
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | React | `^19.2.8` | Declarative user interface |
| **Build Tool** | Vite | `^8.3.0` | Ultra-fast local development & bundling |
| **Language** | TypeScript | `~6.0.2` | Static typing and interfaces |
| **UI Components** | Ant Design (`antd`) | `^6.6.4` | Enterprise metrological UI controls |
| **Icons** | `@ant-design/icons` | `^6.3.4` | System iconography |
| **Styling** | Tailwind CSS + Vanilla CSS | `^3.4.19` | Modern, clean styling |
| **Charts** | Chart.js & `react-chartjs-2` | `^4.5.1` / `^5.3.1` | Error curves & MPE tolerance visualization |
| **Tables** | `@tanstack/react-table` | `^8.21.2` | High-performance observation tables |
| **Date Handling** | Day.js | `^1.11.23` | Timestamp formatting |
| **Linter** | Oxlint | `^1.81.0` | Fast static analysis |

### Backend
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Web Framework** | FastAPI | `0.115.0` | High-performance asynchronous REST API |
| **ASGI Server** | Uvicorn (`standard`) | `0.30.6` | Production ASGI web server |
| **ORM** | SQLAlchemy | `2.0.35` | Relational database mapping |
| **Database Driver** | Psycopg 3 (`psycopg[binary]`) | `3.2.1` | Native PostgreSQL adapter |
| **Data Validation** | Pydantic & Pydantic-Settings | `2.9.2` / `2.5.2` | Request/response schemas and settings |
| **Environment** | python-dotenv | `1.0.1` | Environment variable management |
| **PDF Generation** | ReportLab | `4.2.5` | Programmatic PDF test certificates |
| **DOCX Generation** | python-docx | `1.1.2` | Programmatic Word document generation |
| **Image Processing** | OpenCV (`headless`) & Pillow | `4.10.0.84` / `10.4.0` | Image preprocessing for OCR |
| **OCR Engines** | RapidOCR ONNX / PyTesseract | `0.3.13` (pytesseract) | Text extraction from inspection photos |
| **HTTP Client** | HTTPX | `0.27.2` | Internal async HTTP requests |
| **Migrations** | Alembic | `1.13.3` | Schema migration tooling |

### Database
- **PostgreSQL** (version 14, 15, or 16) with relational schema enforcing foreign keys and integrity constraints.

---

## Project Structure

```text
ps2/
├── .env.example                     # Frontend environment template
├── .gitignore                       # Git exclusion rules
├── package.json                     # Frontend dependencies and npm scripts
├── postcss.config.js                # PostCSS configuration
├── tailwind.config.js               # Tailwind CSS design system
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite build and dev server config
│
├── src/                             # Frontend Source Code
│   ├── assets/                      # Static assets, logos, and icons
│   ├── components/                  # Reusable UI components
│   │   ├── forms/                   # Input forms (instrument registration, etc.)
│   │   ├── layout/                  # AppHeader, Navigation, Sidebar
│   │   ├── oiml/                    # OIML-specific badges, MPE gauges, status tags
│   │   └── ui/                      # Base buttons, cards, modals
│   ├── context/                     # Application state
│   │   └── VerificationContext.tsx  # Session state, step tracking, sessionStorage sync
│   ├── mock/                        # Fallback mock datasets for offline mode
│   ├── services/                    # API clients
│   │   ├── api.ts                   # Axios/Fetch client with base URL configuration
│   │   ├── verificationService.ts   # Session & reading API client
│   │   ├── instrumentService.ts     # Instrument registration API client
│   │   └── evidenceService.ts       # Evidence upload & OCR client
│   ├── types/                       # TypeScript definitions (OIML, Session, Instrument)
│   ├── utils/                       # Numerical helpers, MPE calculation utils
│   └── views/                       # Main application view screens
│       ├── DashboardView.tsx        # Executive dashboard & live stats
│       ├── InstrumentView.tsx       # Instrument registry and search
│       ├── NewTestSessionView.tsx   # 8-step test verification wizard
│       ├── ComplianceView.tsx       # OIML R 76 compliance evaluation & MPE curves
│       ├── EvidenceCaptureView.tsx  # Photo upload & RapidOCR verification
│       ├── SoftwareVerificationView.tsx # Software examination & simulation terminal
│       ├── FingerprintView.tsx      # Metrological fingerprint & drift analysis
│       ├── DigitalReportView.tsx    # PDF / DOCX certificate viewer & export
│       ├── DigitalRepositoryView.tsx# Historical verification archive
│       └── TraceabilityView.tsx     # Tamper-evident audit ledger & CSV export
│
└── backend/                         # Backend Source Code (FastAPI)
    ├── .env.example                 # Backend environment template
    ├── requirements.txt             # Python backend dependencies
    └── app/                         # FastAPI Application Package
        ├── config.py                # Pydantic Settings configuration (.env reader)
        ├── database.py              # SQLAlchemy engine, session maker, init_db()
        ├── main.py                  # FastAPI app factory, CORS, lifespan startup
        ├── api/                     # Modular REST API endpoints
        │   ├── anomaly.py           # /api/anomaly
        │   ├── audit.py             # /api/audit (audit log & integrity check)
        │   ├── compliance.py        # /api/compliance (OIML R 76 evaluation)
        │   ├── dashboard.py         # /api/dashboard (summary statistics)
        │   ├── evidence.py          # /api/evidence (upload & OCR)
        │   ├── fingerprint.py       # /api/fingerprint (statistical fingerprint)
        │   ├── instruments.py       # /api/instruments (CRUD)
        │   ├── readings.py          # /api/readings (measurement observations)
        │   ├── reports.py           # /api/reports (PDF & DOCX generation)
        │   ├── repository.py        # /api/repository (session archive & search)
        │   ├── sessions.py          # /api/sessions (test session lifecycle)
        │   ├── software_exam.py     # /api/software-exam (simulation terminal)
        │   └── software_verification.py # /api/software-verification
        ├── models/                  # SQLAlchemy ORM Models
        │   ├── instrument.py        # Instrument entity
        │   ├── test_session.py      # TestSession entity
        │   ├── reading.py           # Reading entity
        │   ├── compliance.py        # ComplianceResult entity
        │   ├── evidence.py          # EvidenceItem entity
        │   ├── fingerprint.py       # MetrologicalFingerprint entity
        │   ├── anomaly_result.py    # AnomalyResult entity
        │   ├── software_verification.py # SoftwareVerification entity
        │   └── audit_log.py         # AuditLog entity
        ├── schemas/                 # Pydantic Request & Response Schemas
        └── services/                # Business Logic Engines
            ├── compliance/          # Deterministic OIML R 76 rules & MPE formulas
            ├── evidence/            # Image preprocessing, OCR, consistency checker
            ├── fingerprint/         # Statistical feature extraction & SHA-256 hasher
            ├── reports/             # ReportLab PDF & python-docx document builders
            └── software_exam/       # Pre-authored terminal simulation scenarios
```

> **Note on Generated Folders**: The following directories are intentionally excluded from version control via `.gitignore`: `node_modules/`, `backend/venv/`, `dist/`, and `__pycache__/`.

---

## Prerequisites

Ensure the following runtimes and services are installed on your machine before running NAWI TRUST:

- **Node.js**: Version `18.x`, `20.x`, or `24.x` (includes `npm`)
- **Python**: Version `3.10`, `3.11`, or `3.12`
- **PostgreSQL**: Version `14` or higher (running locally on port `5432`)
- **Git**: For version control cloning

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/poojamm06/ps2.git
cd ps2
```

### 2. Frontend Setup
From the repository root directory, install all Node dependencies:
```bash
npm install
```

### 3. Backend Setup
Create and activate a dedicated Python virtual environment inside the `backend` folder:

**Windows (PowerShell / Command Prompt):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

**Linux / macOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Environment Configuration

#### Backend `.env`
Create your backend `.env` file by copying the provided example:

**Windows:**
```powershell
copy backend\.env.example backend\.env
```

**Linux / macOS:**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in your text editor and set your personal PostgreSQL credentials:
```env
# PostgreSQL connection string
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nawi_trust

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true

# CORS Allowed Origins
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> **Security Note**: Never commit `.env` files to Git. Both `.env` and `backend/.env` are strictly excluded in `.gitignore`.

#### Frontend `.env`
Copy the frontend template in the project root:

**Windows:**
```powershell
copy .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Ensure `VITE_API_BASE_URL` points to your backend instance:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 5. PostgreSQL Database Initialization

1. Create a PostgreSQL database named `nawi_trust` using your preferred PostgreSQL tool:
   - **Command Line (psql)**:
     ```sql
     CREATE DATABASE nawi_trust;
     ```
   - **Command Line (createdb)**:
     ```bash
     createdb -U postgres nawi_trust
     ```
   - **pgAdmin**: Right-click *Databases* → *Create* → *Database...* → Name: `nawi_trust`.

2. **Automatic Table Provisioning**:
   - NAWI TRUST does not require manual SQL migration scripts or seed commands.
   - When the FastAPI backend starts, its `lifespan` handler automatically invokes SQLAlchemy's `init_db()` (`Base.metadata.create_all()`). All nine metrological tables (`instruments`, `test_sessions`, `readings`, `evidence`, `compliance_results`, `metrological_fingerprints`, `anomaly_results`, `software_verifications`, and `audit_logs`) will be created automatically if they do not already exist.

---

## Running the Application

### 1. Start the Backend Server

**Windows (PowerShell / Command Prompt):**
```powershell
backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*(Ensure this command is executed with your current working directory set to `backend` or pass `app.main:app` while within the backend folder).*

Alternatively, from the repository root:
```powershell
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Linux / macOS:**
```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will start at: **`http://localhost:8000`**  
Interactive Swagger documentation is available at: **`http://localhost:8000/docs`**

### 2. Start the Frontend Development Server

Open a new terminal window in the repository root directory:
```bash
npm run dev
```

The Vite dev server will start at: **`http://localhost:5173`**

### 3. Verification

Verify that both services are healthy:

1. **Backend Health Check**:
   ```bash
   curl http://localhost:8000/api/health
   # Expected response: {"status":"ok","service":"NAWI TRUST API"}
   ```

2. **Database Connectivity Check**:
   ```bash
   curl http://localhost:8000/api/health/database
   # Expected response: {"status":"ok","database":"connected","database_engine":"PostgreSQL",...}
   ```

3. **Frontend Application**:
   - Open **`http://localhost:5173`** in your browser.
   - The top header will display a green **"Database Connected"** badge, confirming that the frontend is communicating with PostgreSQL via the FastAPI backend.

---

## Technical Disclaimers & Prototype Scope

To ensure transparent metrological evaluation, the following prototype boundaries are explicitly declared:

1. **Statistical Anomaly Detection (Not Machine Learning / AI)**:
   - The anomaly detection module evaluates statistical dispersion (Z-scores and Interquartile Ranges) across observed errors and drift rates. It is strictly **statistical anomaly detection** and does not make claims of deep learning or artificial intelligence.
2. **Software Examination Terminal (Demonstration Simulation)**:
   - The terminal runs pre-authored command/response scenario scripts modeled on OIML R 76 Clause 5.5 and WELMEC Guide 7.2. It simulates diagnostic serial/USB communication for demonstration and type-evaluation purposes; it does not connect to live physical scale hardware or perform live electrical penetration testing.
3. **Dual-Engine OCR**:
   - The OCR engine uses RapidOCR (ONNX runtime) or PyTesseract when native OCR dependencies and weights are present. If native OCR libraries are unavailable on the host system, the application falls back to structured simulation while transparently tagging the output in the user interface.
4. **Cryptographic Hashes (Tamper-Evidence vs Legal PKI)**:
   - The SHA-256 digests in the Metrological Fingerprint and Audit Ledger provide cryptographic data integrity and tamper-evidence. They do not constitute legally certified Public Key Infrastructure (PKI) digital signatures under national digital certificate legislation.
5. **SIH Hackathon Prototype**:
   - NAWI TRUST is an engineering demonstration prototype developed for Smart India Hackathon 2026. Real-world statutory deployment requires formal certification and accreditation by national legal metrology authorities.
