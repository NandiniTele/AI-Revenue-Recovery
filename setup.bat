@echo off
echo ===================================================
echo     RecoverAI - System Setup and Environment Config
echo ===================================================

echo [1/4] Setting up Python 3.11 Virtual Environment...
py -3.11 -m venv venv
call .\venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo [2/4] Generating Synthetic Dataset & Training ML Model...
python ml\dataset_generator.py
python -m ml.model_trainer

echo [3/4] Initializing Database...
python -m backend.seed_db

echo [4/4] Installing Frontend Packages...
cd frontend
call npm install
cd ..

echo ===================================================
echo   Setup Complete!
echo   To launch demo runner:
echo     .\venv\Scripts\python run_demo.py
echo ===================================================
pause
