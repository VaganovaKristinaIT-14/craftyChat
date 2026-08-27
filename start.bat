@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo   CraftyChat launcher
echo ============================================

cd /d "%~dp0backend"
if errorlevel 1 (
    echo ERROR: cannot find backend folder next to start.bat
    goto :end
)

where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    goto :end
)

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: failed to create virtual environment.
        goto :end
    )
)

call venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip >nul

echo Installing core dependencies (required)...
pip install Flask Flask-Cors
if errorlevel 1 (
    echo ERROR: failed to install Flask. Cannot continue.
    goto :end
)

echo Installing optional dependencies (tiktoken, Pillow)...
echo These may fail on very new Python versions - that's OK, app has fallbacks.
pip install tiktoken
pip install Pillow

echo.
echo Starting CraftyChat...
echo Open in browser: http://localhost:5000
python app.py

:end
echo.
echo ============================================
echo Press any key to close this window...
pause >nul