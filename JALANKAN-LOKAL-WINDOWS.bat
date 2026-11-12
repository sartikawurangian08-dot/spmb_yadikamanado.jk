@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 tidak ditemukan. Instal Python atau jalankan server lokal lain.
  pause
  exit /b 1
)
start "" http://localhost:8000
python -m http.server 8000
pause
