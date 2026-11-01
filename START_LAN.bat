@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
echo UZBI WEB LAN MODE: http://0.0.0.0:8090
py -X utf8 -m uvicorn app:app --host 0.0.0.0 --port 8090
pause
