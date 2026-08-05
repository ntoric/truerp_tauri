; Stop TruERP + its bundled Node before NSIS overwrites/removes files.
; Orphaned node.exe (Next.js UI) holds a lock on resources\node\node.exe and
; causes: "Error opening file for writing: ...\resources\node\node.exe".

!macro TRUERP_KILL_RUNTIME
  DetailPrint "Stopping TruERP and bundled Node.js..."
  ; Main shell (ignore errors if not running)
  nsExec::ExecToLog 'taskkill /F /T /IM TruERP.exe'
  Pop $0

  ; Kill ONLY the Node binary under this install dir — never every node.exe.
  System::Call 'kernel32::SetEnvironmentVariable(t, t)i("TRUERP_INSTDIR", "$INSTDIR").r0'
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference=\"SilentlyContinue\"; $$inst=$$env:TRUERP_INSTDIR; if (-not $$inst) { exit 0 }; $$targets=@((Join-Path $$inst \"resources\\node\\node.exe\"),(Join-Path $$inst \"resources\\node.exe\")); Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and ($$targets -contains $$_.ExecutablePath) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"'
  Pop $0

  ; Let Windows release file handles before copy/delete.
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro TRUERP_KILL_RUNTIME
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro TRUERP_KILL_RUNTIME
!macroend
