@echo off
cd /d "%~dp0"
echo ========================================================
echo     RecoverAI - Starting Full Stack Platform
echo ========================================================

echo [+] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "RecoverAI Backend" cmd /k "cd /d ""%~dp0"" && .\venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo [+] Starting React Frontend on http://localhost:5173 ...
start "RecoverAI Frontend" cmd /k "cd /d ""%~dp0\frontend"" && npm run dev"

echo ========================================================
echo   Both services started in separate terminal windows!
echo   - Backend API & Swagger: http://127.0.0.1:8000/docs
echo   - Frontend Web UI:       http://localhost:5173
echo ========================================================

