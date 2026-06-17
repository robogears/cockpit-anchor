# Reader: extract the black-screen timeline from the Cockpit Anchor log.
# Shows the most recent AC session's session-state changes, beginSession, and frame
# shouldRender/visibility transitions — the data that explains the black-screen-on-launch.
# Run:  powershell -ExecutionPolicy Bypass -File debug-read.ps1
$log = "$env:LOCALAPPDATA\CockpitAnchor\cockpit-anchor.log"
if (-not (Test-Path $log)) { "No log at $log"; return }
$lines = Get-Content $log

# Trim to the most recent session (last 'layer loaded' line).
$load = ($lines | Select-String 'layer loaded' | Select-Object -Last 1)
if ($load) { $lines = $lines[($load.LineNumber - 1)..($lines.Count - 1)] }

"==== Black-screen timeline (most recent AC session) ===="
$lines | Where-Object {
    $_ -match '\[evt\]|xrBeginSession|\[frame\]|xrCreateSession|layer loaded|re-base is'
}
"========================================================"
"Tip: watch for the moment [frame] shouldRender flips 0 -> 1 and SessionState reaches"
"VISIBLE/FOCUSED. If that lines up with when you toggled VD->VR, the black screen is a"
"focus/visibility handoff (fix = borderless / explicit VDXR / window-focus nudge)."
