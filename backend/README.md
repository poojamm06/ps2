# NAWI TRUST — Backend API

FastAPI backend for the NAWI TRUST Metrological Verification & Compliance Platform.

---

## Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.115 |
| Server | Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL |
| Schemas | Pydantic v2 |
| Config | python-dotenv |
| Migrations | Alembic |

---

## Quick Start

### 1. Python Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. PostgreSQL Configuration

Ensure PostgreSQL is running locally (default port 5432).

Create the database:

```sql
CREATE DATABASE nawi_trust;
```

### 4. Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual PostgreSQL credentials
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nawi_trust
```

### 5. Create Database Tables

Tables are created automatically on first startup via SQLAlchemy `create_all`.

> **Safe**: `create_all` only creates tables that do not exist. It never drops or alters existing tables.

### 6. Start the API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: **http://localhost:8000**

Interactive docs: **http://localhost:8000/docs**

---

## Health Check

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "NAWI TRUST API"
}
```

---

## API Structure

```
GET  /api/health                    — Health check
GET  /api/instruments               — List all instruments
POST /api/instruments               — Register new instrument
GET  /api/sessions                  — List all test sessions
POST /api/sessions                  — Create new test session
GET  /api/sessions/{session_id}     — Get session by ID
POST /api/readings                  — Record a test reading
POST /api/compliance/calculate      — Run compliance calculation
```

---

## Database Structure

| Table | Description |
|-------|-------------|
| `instruments` | Registered NAWI instruments |
| `test_sessions` | Verification workflow sessions |
| `readings` | Individual test point readings |
| `evidence_items` | Photographic evidence records |
| `compliance_results` | OIML R-76 compliance outcomes |
| `audit_logs` | Immutable audit trail entries |

---

## Compliance Engine

The compliance engine (`app/services/compliance_engine.py`) is a **deterministic rule-based calculator**.

Core calculation:

```
error = indicated_value - reference_value
result = PASS if abs(error) <= mpe else FAIL
```

This is the initial foundation. Full OIML R-76 metrological rules (hysteresis, repeatability,
eccentricity, creep) will be added in subsequent implementation phases.

---

## Architecture Notes

- Frontend (React/Vite on port 5173) and backend (FastAPI on port 8000) are **fully separate**.
- CORS is pre-configured to allow requests from the Vite dev server.
- No authentication in this phase — to be added in a later stage.
- No ML, OCR, or instrument communication in this phase.
