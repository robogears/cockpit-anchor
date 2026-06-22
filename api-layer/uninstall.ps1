# Cockpit Anchor — unregister the implicit OpenXR API layer. HKLM removal requires admin.
# Run as administrator:  powershell -ExecutionPolicy Bypass -File uninstall.ps1
$ErrorActionPreference = 'SilentlyContinue'
$removed = 0
foreach ($hive in 'HKLM','HKCU') {
  $k = "${hive}:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit"
  if (Test-Path $k) {
    foreach ($name in (Get-Item $k).Property) {
      if ($name -like '*CockpitAnchor*') {
        Remove-ItemProperty -Path $k -Name $name -ErrorAction SilentlyContinue
        "Removed: $name  ($hive)"
        $removed++
      }
    }
  }
}
# Also remove the generated manifest from the per-user data dir (the DLL and saved seats are kept).
$manifest = Join-Path $env:LOCALAPPDATA 'CockpitAnchor\CockpitAnchor.json'
if (Test-Path $manifest) { Remove-Item -LiteralPath $manifest -Force -ErrorAction SilentlyContinue; "Removed manifest: $manifest" }

if ($removed -eq 0) { "No Cockpit Anchor registration found." } else { "Cockpit Anchor unregistered." }
