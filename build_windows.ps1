Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $Name"
  }
}

Require-Command python
Require-Command npm

$venvPath = Join-Path $root ".venv-build-win"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating build virtual environment..."
  python -m venv $venvPath
}

Write-Host "Installing backend dependencies into build venv..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r server/requirements.txt
& $venvPython -m pip install pyinstaller

Write-Host "Building frontend..."
Push-Location interface
npm ci --include=dev
npm run build
Pop-Location

Write-Host "Building Windows executable..."
& $venvPython -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --windowed `
  --name WebExeStarter `
  --add-data "db;db" `
  --add-data "interface/dist;interface/dist" `
  --add-data "interface/public/fonts;interface/public/fonts" `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops.asyncio `
  --hidden-import uvicorn.protocols.http.h11_impl `
  --hidden-import uvicorn.lifespan.on `
  --hidden-import h11 `
  --hidden-import pystray._win32 `
  --hidden-import win32print `
  --hidden-import win32ui `
  --hidden-import pythoncom `
  --hidden-import pywintypes `
  launcher.py

Write-Host "Build complete. Output is in dist\WebExeStarter.exe"
