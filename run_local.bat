@echo off
echo ===================================================
echo 🚀 Iniciando CLR BingX Trading Bot (Entorno Local)
echo ===================================================

echo Starting FastAPI Backend on http://localhost:8000 ...
start "BingX Bot Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"

echo Starting React Dashboard on http://localhost:3000 ...
start "BingX Bot Dashboard" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo ✅ ¡Ambos servidores iniciados!
echo 🌐 Backend API: http://localhost:8000
echo 📊 Dashboard Web: http://localhost:3000
echo ===================================================
pause
