"""
RecoverAI - One-Click Hackathon Demo & Validation Runner
Runs dataset generation, ML model training, database seeding, automated test suite,
and starts the FastAPI backend server.
"""

import os
import sys
import subprocess
import time


def print_banner():
    print("=" * 75)
    print("      RECOVERAI - AI-POWERED REVENUE RECOVERY AGENT (TRACK 03)")
    print("   Detect -> Diagnose -> Decide -> Guard -> Execute -> Measure -> Audit")
    print("=" * 75)


def run_cmd(cmd, desc):
    print(f"\n[+] {desc}...")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"[-] Error during: {desc}")
        sys.exit(1)
    print(f"[OK] {desc} completed successfully.")


def main():
    print_banner()
    
    py_exec = f'"{sys.executable}"'
    
    # 1. Dataset Generation
    run_cmd(f"{py_exec} ml/dataset_generator.py", "Generating 1,250 Synthetic Merchant Transactions")
    
    # 2. ML Model Training & Held-Out Evaluation
    run_cmd(f"{py_exec} -m ml.model_trainer", "Training & Evaluating ML Risk Classifier (70/15/15 Split)")
    
    # 3. Database Seeding
    run_cmd(f"{py_exec} -m backend.seed_db", "Seeding SQLite Database with Transactions & ML Scores")
    
    # 4. Run Pytest Suite
    run_cmd(f"{py_exec} -m pytest tests/ -v", "Running Full Safety, Policy & API Test Suite")
    
    print("\n" + "=" * 75)
    print("   ALL RECOVERAI SYSTEM CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 75)
    print("\nTo start the full stack application:")
    print("  Backend API:  uvicorn backend.main:app --port 8000 --reload")
    print("  Frontend UI:  cd frontend && npm run dev")
    print("  Open Browser: http://localhost:5173")
    print("=" * 75)


    if "--serve" in sys.argv:
        print("\n[+] Starting FastAPI Uvicorn Server on http://127.0.0.1:8000 ...")
        subprocess.run(f"{py_exec} -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload", shell=True)


if __name__ == "__main__":
    main()
