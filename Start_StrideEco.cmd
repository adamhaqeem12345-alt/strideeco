@echo off
setlocal
cd /d "%~dp0"
node scripts\launch-local.mjs
if errorlevel 1 pause
