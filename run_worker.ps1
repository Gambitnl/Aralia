param ([string]$Prompt, [string]$OutFile)
Write-Host " [Worker] Started: $Prompt"
# Use cmd /c to ensure gemini is found in path if ps1 fails, but try direct first.
# Using 'gemini' directly assuming it's in PATH.
# The user's example used `> $OutFile`, but Out-File is more idiomatic in PS.
# However, `gemini -p` might write to stdout.
# We also need to handle the encoding.

$env:PYTHONIOENCODING="utf-8" # Good practice just in case

# Invoke gemini. Note: checking previous logs, gemini --version worked.
# We use Start-Process -Wait to ensure synchronous execution if simple call doesn't block (though call operator & usually blocks for console apps)
# But standard pipe blocks.

gemini -p "$Prompt" | Out-File -FilePath $OutFile -Encoding UTF8

Write-Host " [Worker] Finished. Output saved to $OutFile"
