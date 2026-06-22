# Cockpit Anchor — register the implicit OpenXR API layer (HKLM, requires admin).
# Relocatable: run from the release folder (DLL beside this script) or the source tree.
# Run as administrator:  powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# Locate the DLL: release layout (beside this script) or source build layout.
$dll = @(
  (Join-Path $here 'CockpitAnchorLayer.dll'),
  (Join-Path $here 'build\CockpitAnchorLayer.dll'),
  (Join-Path $here 'api-layer\build\CockpitAnchorLayer.dll')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $dll) { throw "CockpitAnchorLayer.dll not found near $here. Extract the full release, or build it first (api-layer\build.ps1)." }
$dll = (Resolve-Path $dll).Path

# Write the layer manifest to a STABLE per-user location, NOT beside this script. The app folder is
# wiped and recreated on every in-app update, so a manifest stored there gets deleted and the
# registration silently goes stale. %LOCALAPPDATA%\CockpitAnchor survives updates; library_path still
# points at the DLL (the app re-lays the DLL at the same resources path each update, so the layer
# auto-upgrades with it). ConvertTo-Json escapes backslashes.
$dataDir = Join-Path $env:LOCALAPPDATA 'CockpitAnchor'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$manifestPath = Join-Path $dataDir 'CockpitAnchor.json'
[ordered]@{
  file_format_version = '1.0.0'
  api_layer = [ordered]@{
    name                   = 'XR_APILAYER_COCKPITANCHOR_seatanchor'
    library_path           = $dll
    api_version            = '1.0'
    implementation_version = '1'
    description            = 'Cockpit Anchor - persistent seated VR cockpit anchor for Assetto Corsa'
    disable_environment    = 'XR_APILAYER_COCKPITANCHOR_DISABLE'
  }
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding ascii

# Remove ANY previous Cockpit Anchor registration first (from older versions / other folders),
# so installing cleanly REPLACES the old one instead of stacking a duplicate.
$old = 0
foreach ($hive in 'HKLM','HKCU') {
  $k = "${hive}:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit"
  if (Test-Path $k) {
    foreach ($name in (Get-Item $k).Property) {
      if ($name -like '*CockpitAnchor*') { Remove-ItemProperty -Path $k -Name $name -ErrorAction SilentlyContinue; $old++ }
    }
  }
}

# Register THIS version in HKLM implicit layers (OpenComposite's bundled OpenXR loader does not read HKCU).
$klm = 'HKLM:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit'
try {
  New-Item -Path $klm -Force | Out-Null
  New-ItemProperty -Path $klm -Name $manifestPath -PropertyType DWord -Value 0 -Force | Out-Null
} catch {
  throw "Could not write HKLM (run this as administrator). $($_.Exception.Message)"
}
if ($old -gt 0) { "Replaced $old previous Cockpit Anchor registration(s)." }

"Installed Cockpit Anchor:"
"  DLL:      $dll"
"  Manifest: $manifestPath"
"  Registry: $klm  (0 = enabled)"
"Launch Assetto Corsa in VR, get in a car, and press Ctrl+Shift+S to calibrate."
