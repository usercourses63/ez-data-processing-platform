@echo off
setlocal

set APP_NAME=docs-viewer
set BUILD_DIR=dist

echo [Build] Cleaning previous builds...
if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
mkdir %BUILD_DIR%

echo [Build] Copying Docusaurus build output...
if not exist build (
    echo [ERROR] 'build' folder not found!
    echo         Run 'npm run build' in your Docusaurus project first,
    echo         then copy the 'build' folder here.
    exit /b 1
)

echo [Build] Compiling for Windows (x64)...
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -o %BUILD_DIR%\%APP_NAME%-windows-amd64.exe .
if %errorlevel% neq 0 (
    echo [ERROR] Windows build failed
    exit /b 1
)

echo [Build] Compiling for Linux (x64)...
set GOOS=linux
set GOARCH=amd64
go build -ldflags="-s -w" -o %BUILD_DIR%\%APP_NAME%-linux-amd64 .
if %errorlevel% neq 0 (
    echo [ERROR] Linux build failed
    exit /b 1
)

echo [Build] Compiling for macOS (x64)...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags="-s -w" -o %BUILD_DIR%\%APP_NAME%-darwin-amd64 .
if %errorlevel% neq 0 (
    echo [ERROR] macOS build failed
    exit /b 1
)

echo [Build] Compiling for macOS (ARM / Apple Silicon)...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags="-s -w" -o %BUILD_DIR%\%APP_NAME%-darwin-arm64 .
if %errorlevel% neq 0 (
    echo [ERROR] macOS ARM build failed
    exit /b 1
)

echo.
echo [Build] Done! Binaries in .\%BUILD_DIR%\
dir /b %BUILD_DIR%
