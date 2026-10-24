@echo off
title Durak 3D - HUGOLAB
cd /d "%~dp0"

echo ===================================================
echo           DURAK (DURNIUS) 3D - HUGOLAB
echo ===================================================
echo.

if not exist node_modules (
    echo [INFO] Diegiamos priklausomybes...
    call npm install
    if errorlevel 1 (
        echo [KLAIDA] Nepavyko idiegti npm paketu.
        pause
        exit /b %errorlevel%
    )
)

echo [INFO] Paleidziamas serveris ir atidaroma narsykle...
start "" http://localhost:5173
call npm run dev -- --open

pause

