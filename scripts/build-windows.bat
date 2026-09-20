@echo off
echo ====================================================================
echo  VoiceFlow - Windows 11 Desktop Voice Dictation Installer Builder
echo ====================================================================
echo.

echo [1/4] Checking Rust and Cargo installation...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Rust and Cargo are required. Download from https://rustup.rs
    exit /b 1
)

echo [2/4] Installing frontend dependencies...
call npm install

echo [3/4] Building frontend assets...
call npm run build

echo [4/4] Compiling Windows Native Executable & NSIS/MSI Installer...
call npx tauri build

echo.
echo ====================================================================
echo  BUILD COMPLETE!
echo  Binaries generated in:
echo   - Target: src-tauri\target\release\VoiceFlow.exe
echo   - NSIS Installer: src-tauri\target\release\bundle\nsis\VoiceFlow_1.0.0_x64-setup.exe
echo   - MSI Installer:  src-tauri\target\release\bundle\msi\VoiceFlow_1.0.0_x64_en-US.msi
echo ====================================================================
