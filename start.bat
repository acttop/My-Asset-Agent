@echo off
cd /d "%~dp0"

echo "내 자산관리 앱을 시작합니다..."
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

npm run dev

pause
