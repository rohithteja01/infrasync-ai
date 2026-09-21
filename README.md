# OIL AI Copilot

OIL AI Copilot is an AI-powered infrastructure project planning-to-execution platform designed for industrial and capital-intensive infrastructure workflows.

This repository contains the **Project Foundation** tier (FastAPI backend + PostgreSQL configuration + React/Vite/Tailwind frontend + `/api/health` connectivity).

---

## 1. Project Architecture

```
SIH-1/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── health.py          # GET /api/health endpoint
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py          # Environment settings (Pydantic)
│   │   │   └── database.py        # PostgreSQL connection engine & session
│   │   ├── models/
│   │   │   └── __init__.py        # Declarative model base registry
│   │   ├── __init__.py
│   │   └── main.py                # FastAPI application entry & CORS
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Backend environment template
│   └── .env                       # Local environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── HealthStatus.jsx   # Live /api/health check component
│   │   ├── App.jsx                # Foundation overview UI
│   │   ├── index.css              # Tailwind CSS styles
│   │   └── main.jsx               # React 18 DOM mount
│   ├── index.html                 # HTML shell
│   ├── package.json               # Frontend dependencies & scripts
│   ├── vite.config.js             # Vite config & API reverse proxy
│   ├── tailwind.config.js         # Tailwind styling palette
│   ├── postcss.config.js          # PostCSS configuration
│   ├── .env.example               # Frontend environment template
│   └── .env                       # Frontend local environment
│
└── README.md                      # Project documentation
```

---

## 2. Prerequisites

- **Python**: 3.10 or higher (Python 3.13 supported)
- **Node.js**: 18.x or higher (Node 24+ supported)
- **PostgreSQL**: Optional for basic health check, required for database persistence (PostgreSQL 14+)

---

## 3. Backend Setup and Execution

### Step 1: Navigate to backend directory
```powershell
cd backend
```

### Step 2: Create and activate a virtual environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 3: Install dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure environment variables
Ensure the `.env` file exists (a default is pre-created from `.env.example`):
```env
PROJECT_NAME="OIL AI Copilot"
API_V1_STR="/api"
PORT=8000
HOST="0.0.0.0"
DATABASE_URL="<YOUR_DATABASE_URL>"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

### Step 5: Start the FastAPI backend server
```powershell
uvicorn app.main:app --reload --port 8000
```

The backend will be live at:
- **API Root**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Health Check Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Docs**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 4. Frontend Setup and Execution

### Step 1: Navigate to frontend directory
```powershell
cd frontend
```

### Step 2: Install Node dependencies
```powershell
npm install
```

### Step 3: Start the Vite development server
```powershell
npm run dev
```

The frontend will be live at:
- **Frontend URL**: [http://localhost:5173](http://localhost:5173)

---

## 5. API Health Endpoint Verification

You can verify the backend is running by requesting the health check:

### cURL
```powershell
curl http://127.0.0.1:8000/api/health
```

### Response Example
```json
{
  "status": "healthy",
  "service": "OIL AI Copilot",
  "version": "0.1.0",
  "timestamp": "2026-09-08T17:25:00.000000+00:00",
  "database": {
    "status": "connected",
    "message": "PostgreSQL database is connected and responding."
  }
}
```

---

## 6. Architecture Layers Roadmap

1. **Project Foundation** *(Completed)*
2. **Data Ingestion Layer** *(Upcoming)*
3. **Execution Capture Layer** *(Upcoming)*
4. **Activity Intelligence Layer** *(Upcoming)*
5. **Validation & Governance** *(Upcoming)*
6. **Schedule Linking Layer** *(Upcoming)*
7. **Schedule Intelligence** *(Upcoming)*
8. **AI Decision Intelligence** *(Upcoming)*
9. **Decision Center** *(Upcoming)*
10. **Institutional Memory** *(Upcoming)*
