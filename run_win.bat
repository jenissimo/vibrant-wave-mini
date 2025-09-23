@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo 🌊 ============================================
echo    🎨 VIBRANT WAVE MINI (BAT) 🎨
echo ============================================

set "PROJECT_DIR=%CD%"

REM ------------------- bun check ------------------
echo 🚀 Checking Bun...
where bun >nul 2>nul
if errorlevel 1 (
  echo ⚠️  Bun not found. Installing...
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo 📦 Installing Bun via winget...
    winget install -e --id Oven-sh.Bun --silent --accept-package-agreements --accept-source-agreements
  ) else (
    echo 📦 Installing Bun via PowerShell script...
    powershell -NoProfile -Command "try { iwr -UseBasicParsing https://bun.sh/install.ps1 ^| iex } catch { exit 1 }"
    if errorlevel 1 (
      echo ❌ Failed to install Bun.
      exit /b 1
    )
  )
  set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
) else (
  echo ✅ Bun found
)

where bun >nul 2>nul
if errorlevel 1 (
  echo ❌ bun not on PATH. Add "%USERPROFILE%\.bun\bin" to PATH or restart your shell.
  exit /b 1
)

REM ------------------- deps -----------------------
echo 📦 Checking dependencies...
if not exist "node_modules" (
  echo 🔄 Running bun install...
  bun install
  if errorlevel 1 (
    echo ❌ bun install failed.
    exit /b 1
  )
  echo ✅ Dependencies installed!
) else (
  echo ✅ Dependencies already installed
)

REM ------------------- OPENROUTER_API_KEY --------
echo 🔑 Checking OPENROUTER_API_KEY...
set "HAS_OR_KEY="
if defined OPENROUTER_API_KEY set "HAS_OR_KEY=1"
if not defined HAS_OR_KEY if exist ".env.local" (
  for /f "usebackq delims=" %%A in (`findstr /R /C:"^[ ]*OPENROUTER_API_KEY[ ]*=" ".env.local"`) do set "HAS_OR_KEY=1"
)
if not defined HAS_OR_KEY if exist ".env" (
  for /f "usebackq delims=" %%A in (`findstr /R /C:"^[ ]*OPENROUTER_API_KEY[ ]*=" ".env"`) do set "HAS_OR_KEY=1"
)
if not defined HAS_OR_KEY (
  echo ❌ Missing OPENROUTER_API_KEY in environment or .env files
  echo Create .env or .env.local with:
  echo   OPENROUTER_API_KEY=sk-or-...
  echo Optional:
  echo   OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image-preview
  exit /b 1
) else (
  echo ✅ OPENROUTER_API_KEY found.
)

REM ------------------- detect port ----------------
set "PORT="

REM 0) env var PORT (если вдруг задан)
if defined PORT goto port_found

REM 1) Check .env files for PORT
if exist ".env.local" (
  for /f "tokens=2 delims==" %%A in ('findstr /R /C:"^[ ]*PORT[ ]*=" ".env.local"') do set "PORT=%%A"
)
if not defined PORT if exist ".env" (
  for /f "tokens=2 delims==" %%A in ('findstr /R /C:"^[ ]*PORT[ ]*=" ".env"') do set "PORT=%%A"
)

REM 2) Check package.json for dev script port
if not defined PORT if exist "package.json" (
  for /f "tokens=*" %%A in ('findstr /C:"dev" package.json') do (
    echo %%A | findstr "-p " >nul
    if not errorlevel 1 (
      for /f "tokens=3" %%B in ("%%A") do set "PORT=%%B"
    )
  )
)

:port_found
if not defined PORT set "PORT=3000"
echo 🧭 Target dev port: %PORT%

REM ------------------- start server --------------
echo.
echo 🚀 Starting dev server...

REM Только добавляем -p, если PORT определён (число)
set "DEV_ARGS="
echo %PORT%| findstr /R "^[0-9][0-9]*$" >nul
if not errorlevel 1 set "DEV_ARGS=-- -p %PORT%"

start "VIBRANT WAVE MINI" cmd /k bun run dev %DEV_ARGS%

REM ------------------- wait for readiness --------
echo ⏳ Waiting for server to be ready...
set "TIMEOUT_SEC=60"
set /a "_elapsed=0"

:wait_loop
REM 1) curl (тихо)
curl --head --silent --fail http://localhost:%PORT%/ >nul 2>nul
if not errorlevel 1 goto ready

REM 2) PowerShell Invoke-WebRequest без пайпов (никаких ^| и прочего)
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:%PORT%/') -Method Head -TimeoutSec 2; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto ready

REM sleep 2s
ping -n 3 127.0.0.1 >nul
set /a "_elapsed=_elapsed+2"
if %_elapsed% GEQ %TIMEOUT_SEC% goto not_ready
goto wait_loop

:ready
echo ✅ Server is up on http://localhost:%PORT%/
start "" "http://localhost:%PORT%/"
echo 📋 Logs are in the "VIBRANT WAVE MINI" window. Press Ctrl+C there to stop.
goto end

:not_ready
echo ❌ Server failed to respond within %TIMEOUT_SEC% seconds.
echo    You can still check logs in the "VIBRANT WAVE MINI" window.

:end
endlocal
