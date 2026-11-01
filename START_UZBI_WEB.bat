@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
echo ============================================================
echo UZBI WEB v10.3 - PRODUCT INTELLIGENCE + ACTIVE LOTS
echo ============================================================
echo Local: http://127.0.0.1:8090
echo Diagnostics: http://127.0.0.1:8090/api/system/health
echo Stop: Ctrl+C
echo.
py -X utf8 -m uvicorn app:app --host 127.0.0.1 --port 8090
if errorlevel 1 (
 echo.
 echo Run INSTALL_WINDOWS.bat first.
 pause
)
