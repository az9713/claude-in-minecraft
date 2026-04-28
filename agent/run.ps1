# ClaudeBot agent runner - polls chat queue and invokes claude -p headless
$queueFile  = "$PSScriptRoot\..\bot\chat-queue.txt"
$lockFile   = "$PSScriptRoot\claude-busy.lock"
$mcpConfig  = "$PSScriptRoot\mcp-config.json"
$promptFile = "$PSScriptRoot\prompt.md"
$logFile    = "$PSScriptRoot\agent.log"

Write-Host "[Agent] ClaudeBot runner started. Watching $queueFile"
Write-Host "[Agent] Press Ctrl+C to stop."

while ($true) {
    Start-Sleep -Milliseconds 500

    # Stale lockfile guard (>60s means claude crashed without cleanup)
    if (Test-Path $lockFile) {
        $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
        if ($age.TotalSeconds -gt 60) {
            Write-Host "[Agent] Stale lock detected, removing"
            Remove-Item $lockFile -Force
        } else {
            continue
        }
    }

    if (-not (Test-Path $queueFile)) { continue }

    $msg = Get-Content $queueFile -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($msg)) { continue }

    # Claim the queue
    New-Item $lockFile -ItemType File -Force | Out-Null
    Clear-Content $queueFile

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry  = "$timestamp | INPUT: $($msg.Trim())"
    Write-Host "[Agent] $logEntry"
    Add-Content $logFile $logEntry

    # Invoke Claude headless
    $result = & claude -p `
        --strict-mcp-config `
        --mcp-config $mcpConfig `
        --append-system-prompt-file $promptFile `
        --permission-mode bypassPermissions `
        --max-turns 8 `
        $msg.Trim() 2>&1

    $resultEntry = "$timestamp | OUTPUT: $result"
    Add-Content $logFile $resultEntry
    Write-Host "[Agent] Done."

    Remove-Item $lockFile -Force
}
