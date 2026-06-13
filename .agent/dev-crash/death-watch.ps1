$log = 'F:\Repos\Aralia\.agent\dev-crash\death-watch.log'
foreach ($pid_ in @(24704, 5412)) {
  Start-Job -ArgumentList $pid_, $log -ScriptBlock {
    param($watchPid, $log)
    try {
      $p = Get-Process -Id $watchPid -ErrorAction Stop
      $p.WaitForExit()
      $code = try { $p.ExitCode } catch { 'unavailable' }
      Add-Content $log "[$(Get-Date -Format o)] PID $watchPid EXITED, code=$code"
    } catch {
      Add-Content $log "[$(Get-Date -Format o)] PID $watchPid watcher error: $_"
    }
  } | Out-Null
}
Get-Job | Wait-Job | Out-Null
