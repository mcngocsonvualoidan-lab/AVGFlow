@echo off
echo ================================
echo   WEATHER WIDGET QUICK SETUP
echo ================================
echo.

echo [1/3] Checking Location Service...
sc query lfsvc | find "RUNNING" >nul
if errorlevel 1 (
    echo   Location Service: NOT RUNNING
    echo   Attempting to start...
    net start lfsvc >nul 2>&1
    if errorlevel 1 (
        echo   ERROR: Cannot start Location Service
        echo   Please run as Administrator or start manually
    ) else (
        echo   Location Service: STARTED
    )
) else (
    echo   Location Service: RUNNING
)
echo.

echo [2/3] Opening Location Settings...
start ms-settings:privacy-location
echo   Please enable:
echo   - "Location for this device" toggle
echo   - Your browser in the apps list
echo.
pause

echo [3/3] Opening test tool...
start "" "%~dp0test-weather-api.html"
echo   Click "RUN FULL TEST" to verify
echo.

echo ================================
echo   SETUP COMPLETE!
echo ================================
echo.
echo Next steps:
echo 1. Allow location in browser popup
echo 2. Wait for test results
echo 3. If PASS, visit: https://avgflow-dd822.web.app
echo.
pause
