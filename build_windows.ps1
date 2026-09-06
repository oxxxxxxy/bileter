param(
  [string]$Name = "WebExeStarter",
  [string]$Arch = ""
)

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

$pyBitness = (& python -c "import struct; print(struct.calcsize('P') * 8)").Trim()
if (-not $Arch) {
  $Arch = if ($pyBitness -eq "32") { "x86" } else { "x64" }
}

Write-Host "Target configuration: Name=$Name, Arch=$Arch (Python $pyBitness-bit)"

$venvPath = Join-Path $root ".venv-build-win-$Arch"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

if (Test-Path $venvPython) {
  $venvBitness = (& $venvPython -c "import struct; print(struct.calcsize('P') * 8)").Trim()
  if ($venvBitness -ne $pyBitness) {
    Write-Host "Architecture mismatch in $venvPath ($venvBitness-bit vs host $pyBitness-bit), recreating virtual environment..."
    Remove-Item -Recurse -Force $venvPath
  }
}

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating build virtual environment for $Arch..."
  python -m venv $venvPath
}

Write-Host "Installing backend dependencies into build venv ($Arch)..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r server/requirements.txt
& $venvPython -m pip install pyinstaller

Write-Host "Building frontend..."
Push-Location interface
npm ci --include=dev
npm run build
Pop-Location

$extraBinaries = @()

$pywin32SysDir = Join-Path $venvPath "Lib\site-packages\pywin32_system32"
if (Test-Path $pywin32SysDir) {
  Get-ChildItem -Path $pywin32SysDir -Filter "*.dll" -File | ForEach-Object {
    Write-Host "Including pywin32 system DLL: $($_.Name)"
    $extraBinaries += @("--add-binary", "$($_.FullName);.")
  }
}

$basePrefix = (& $venvPython -c "import sys; print(sys.base_prefix)").Trim()
if (Test-Path $basePrefix) {
  Get-ChildItem -Path $basePrefix -Filter "*.dll" -File -Recurse | Where-Object {
    $_.Name -match "^(vcruntime140|msvcp140|ucrtbase)"
  } | ForEach-Object {
    Write-Host "Including C runtime DLL: $($_.Name)"
    $extraBinaries += @("--add-binary", "$($_.FullName);.")
  }
}

Write-Host "Building Windows executable ($Name, $Arch)..."
$pyinstallerArgs = @(
  "-m", "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--windowed",
  "--name", $Name,
  "--add-data", "db;db",
  "--add-data", "interface/dist;interface/dist",
  "--add-data", "interface/public/fonts;interface/public/fonts",
  "--add-data", "server/app/fonts;server/app/fonts",
  "--hidden-import", "uvicorn.logging",
  "--hidden-import", "uvicorn.loops.asyncio",
  "--hidden-import", "uvicorn.protocols.http.h11_impl",
  "--hidden-import", "uvicorn.lifespan.on",
  "--hidden-import", "h11",
  "--hidden-import", "pystray._win32",
  "--hidden-import", "win32print",
  "--hidden-import", "win32ui",
  "--hidden-import", "win32gui",
  "--hidden-import", "win32con",
  "--hidden-import", "pythoncom",
  "--hidden-import", "pywintypes",
  "--hidden-import", "PIL._imaging",
  "--hidden-import", "PIL.ImageWin"
)

if ($extraBinaries.Count -gt 0) {
  $pyinstallerArgs += $extraBinaries
}

$pyinstallerArgs += "launcher.py"

& $venvPython $pyinstallerArgs

Write-Host "Build complete. Output is in dist\$Name.exe"
