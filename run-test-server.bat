@echo off
echo =======================================
echo   Starting Local Server for Test Tool
echo =======================================
echo.
echo Server will start at: http://localhost:8000
echo Press Ctrl+C to stop server
echo.
echo Starting in 3 seconds...
timeout /t 3 >nul

cd /d "%~dp0"
python -m http.server 8000 2>nul
if errorlevel 1 (
    echo Python not found, trying Node.js...
    npx http-server -p 8000 -o test-weather-api.html
)
