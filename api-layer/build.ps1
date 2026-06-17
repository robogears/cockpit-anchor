# Build the Cockpit Anchor OpenXR API layer DLL (Visual Studio MSVC x64).
# Needs the OpenXR SDK headers at <repo>/deps/OpenXR-SDK first:
#   git clone --depth 1 https://github.com/KhronosGroup/OpenXR-SDK deps/OpenXR-SDK
# Then:  powershell -ExecutionPolicy Bypass -File api-layer/build.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path      # api-layer
$root = Split-Path -Parent $here                              # repo root
$inc  = Join-Path $root 'deps\OpenXR-SDK\include'
if (-not (Test-Path (Join-Path $inc 'openxr\openxr.h'))) {
  throw "OpenXR headers not found at $inc`nRun:  git clone --depth 1 https://github.com/KhronosGroup/OpenXR-SDK `"$root\deps\OpenXR-SDK`""
}
$src    = Join-Path $here 'src\layer.cpp'
$outDir = Join-Path $here 'build'
New-Item -ItemType Directory -Force $outDir | Out-Null
$outDll = Join-Path $outDir 'CockpitAnchorLayer.dll'

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsPath  = & $vswhere -latest -property installationPath
if (-not $vsPath) { throw "Visual Studio not found (vswhere returned nothing). Install VS with the C++ workload." }
$vcvars  = Join-Path $vsPath 'VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path $vcvars)) { throw "vcvars64.bat not found at $vcvars" }

$cl = "cl /nologo /LD /MT /EHsc /O2 /std:c++17 /DWIN32 /D_WINDOWS /I`"$inc`" `"$src`" /Fe:`"$outDll`" /Fo:`"$outDir\\`""
cmd /c "call `"$vcvars`" >nul 2>nul && $cl"
if (Test-Path $outDll) { "Built: $outDll  ($((Get-Item $outDll).Length) B)" } else { throw "Build failed" }
