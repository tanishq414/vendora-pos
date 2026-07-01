@echo off
REM Unified start script for Vendora POS (frontend + backend)
cd /d %~dp0\new\backend
start cmd /k "node server.js"
cd /d %~dp0\new
npm start
