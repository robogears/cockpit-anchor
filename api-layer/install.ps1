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

# Write the layer manifest next to this script, pointing at the DLL. ConvertTo-Json escapes backslashes.
$manifestPath = Join-Path $here 'CockpitAnchor.json'
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

# Register in HKLM implicit layers (OpenComposite's bundled OpenXR loader does not read HKCU).
$klm = 'HKLM:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit'
try {
  New-Item -Path $klm -Force | Out-Null
  New-ItemProperty -Path $klm -Name $manifestPath -PropertyType DWord -Value 0 -Force | Out-Null
} catch {
  throw "Could not write HKLM (run this as administrator). $($_.Exception.Message)"
}

"Installed Cockpit Anchor:"
"  DLL:      $dll"
"  Manifest: $manifestPath"
"  Registry: $klm  (0 = enabled)"
"Launch Assetto Corsa in VR, get in a car, and press Ctrl+Shift+S to calibrate."
