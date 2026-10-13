@echo off
title TraceBack Server
echo ======================================================
echo  Starting TraceBack Lost and Found Server...
echo ======================================================
cd /d "%~dp0"
node server.js
pause
