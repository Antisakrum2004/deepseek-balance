@echo off
setlocal
rem Double-click remover for the DSH token-balance chip.
set "SCRIPT=%~dp0skill\scripts\uninstall.ps1"
where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
)
echo.
pause
