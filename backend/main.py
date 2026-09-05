"""
RecoverAI - FastAPI Main Application
AI-Powered Revenue Recovery Agent Backend API Server
"""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Fix Windows console encoding — ensures ₹ (U+20B9) and other Unicode
# characters in API responses and log output don't crash uvicorn on Windows
# (which defaults to cp1252 / charmap codec).
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Load environment variables
load_dotenv()

from backend.database import engine, Base
from backend.seed_db import seed_database_from_csv
from backend.routers import (
    dashboard,
    transactions,
    agent,
    recovery,
    audit,
    analytics,
    assistant,
    demo
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and seed initial demo data if needed
    Base.metadata.create_all(bind=engine)
    seed_database_from_csv(reset_existing=False)
    print("RecoverAI Backend Engine Initialized and Ready.")
    yield
    print("Shutting down RecoverAI Backend.")


app = FastAPI(
    title="RecoverAI - AI Revenue Recovery Agent",
    description="Track 03 - AI Revenue Recovery: Automated revenue-at-risk detection, diagnosis, bounded execution, and audit logging.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware configuration
# ALLOWED_ORIGINS env var accepts comma-separated list of allowed origins.
# For production: set ALLOWED_ORIGINS in Render to your Vercel frontend URL.
# e.g.: https://ai-revenue-recovery.vercel.app,https://ai-revenue-recovery-rust-seven.vercel.app
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Always allow local development origins
_local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_allowed_origins = list(set(_local_origins + _allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"^(http://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.github\.io)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(agent.router)
app.include_router(recovery.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(assistant.router)
app.include_router(demo.router)


@app.get("/")
def root():
    return {
        "project": "RecoverAI – AI-Powered Revenue Recovery Agent",
        "track": "Track 03 – AI Revenue Recovery",
        "status": "RUNNING",
        "mode": "TEST_MODE_ONLY",
        "documentation": "/docs",
        "endpoints": {
            "dashboard": "/api/dashboard",
            "transactions": "/api/transactions",
            "agent_diagnosis": "/api/agent/analyze/{id}",
            "batch_recovery": "/api/agent/batch-recover",
            "audit_trail": "/api/audit",
            "ml_analytics": "/api/analytics",
            "merchant_assistant": "/api/assistant/chat",
            "demo_controls": "/api/demo/reset"
        }
    }


@app.get("/health")
def health():
    return {"status": "HEALTHY", "test_mode": True}


@app.get("/api/version")
def version():
    """Returns build metadata for debugging and transparency."""
    import datetime as dt
    return {
        "name": "RecoverAI",
        "version": "1.0.0",
        "track": "Track 03 – AI Revenue Recovery",
        "mode": "TEST_MODE_ONLY",
        "build_date": "2026-09-05",
        "server_time": dt.datetime.utcnow().isoformat(),
        "stack": {
            "backend": "FastAPI + SQLAlchemy + SQLite",
            "ml": "Scikit-Learn GradientBoosting",
            "frontend": "React 18 + Vite + Tailwind CSS"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
