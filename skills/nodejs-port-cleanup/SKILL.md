---
name: nodejs-port-cleanup
description: |
  Automatically kill existing processes on a port before starting a Node.js server.
  Use when: (1) EADDRINUSE error occurs on server startup, (2) previous server
  instance is still running, (3) port conflict prevents development server from
  starting. Cross-platform solution for Windows (netstat/taskkill) and Unix (lsof/kill).
author: Claude Code
version: 1.0.0
date: 2025-01-20
---

# Node.js Port Cleanup on Server Start

## Problem
When restarting a development server, you often encounter `EADDRINUSE: address already in use`
errors because a previous instance is still running. This is especially common when:
- The server was started in a background process that wasn't properly terminated
- The terminal was closed without stopping the server
- The server crashed but the process didn't exit cleanly

## Context / Trigger Conditions
- Error: `Error: listen EADDRINUSE: address already in use :::PORT`
- Attempting to start a dev server that was recently running
- Background tasks holding ports after their parent process ended
- IDE or terminal sessions that didn't clean up properly

## Solution

Add this function to your Node.js server startup script:

```typescript
import { execSync } from 'child_process';

/**
 * Kills any existing process using the specified port.
 * This prevents EADDRINUSE errors when restarting the server.
 * Works on Windows by using netstat to find the PID and taskkill to terminate it.
 * Works on Unix/Mac by using lsof to find and kill the process.
 */
function killProcessOnPort(port: number): void {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // Use netstat to find the PID of the process listening on this port
      // netstat output format: "  TCP    0.0.0.0:3847    0.0.0.0:0    LISTENING    12345"
      const netstatOutput = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      });

      // Parse each line to extract PIDs of listening processes
      const lines = netstatOutput.trim().split('\n');
      const pids = new Set<string>();

      for (const line of lines) {
        // Only target LISTENING connections on our exact port
        if (line.includes('LISTENING')) {
          // Split by whitespace and get the last column (PID)
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
          }
        }
      }

      // Kill each process found
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          console.log(`Killed existing process on port ${port} (PID: ${pid})`);
        } catch {
          // Process may have already exited, ignore
        }
      }
    } else {
      // Unix/Mac: use lsof to find and kill the process
      const lsofOutput = execSync(`lsof -ti:${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const pids = lsofOutput.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: ['pipe', 'pipe', 'pipe'] });
          console.log(`Killed existing process on port ${port} (PID: ${pid})`);
        } catch {
          // Process may have already exited, ignore
        }
      }
    }
  } catch {
    // No process found on port - this is fine, nothing to kill
  }
}

// Call before creating the server
const PORT = 3000;
killProcessOnPort(PORT);

// Then create and start your server as normal
const server = http.createServer(/* ... */);
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

## Verification

When the function successfully kills a process, you'll see:
```
Killed existing process on port 3847 (PID: 12345)
```

If no process was found (port was free), the function silently proceeds.

## Example

Before this fix:
```
> npx tsx scripts/my-server.ts
Error: listen EADDRINUSE: address already in use :::3847
```

After adding `killProcessOnPort()`:
```
> npx tsx scripts/my-server.ts
Killed existing process on port 3847 (PID: 39592)

Server running at http://localhost:3847
```

## Notes

- **Windows**: Uses `netstat -ano` to find PIDs and `taskkill /F` to force-kill
- **Unix/Mac**: Uses `lsof -ti:PORT` to find PIDs and `kill -9` to force-kill
- The function silently handles cases where no process is found (empty catch block)
- Only targets processes in LISTENING state to avoid killing unrelated connections
- Force-kill (`/F` on Windows, `-9` on Unix) ensures stubborn processes are terminated
- Consider adding a small delay after killing if the port doesn't release immediately

## Alternative: Manual Cleanup Commands

If you need to manually kill a process on a port:

**Windows:**
```powershell
# Find the PID
netstat -ano | findstr :3847

# Kill it
taskkill /PID <pid> /F
# Or via PowerShell
Stop-Process -Id <pid> -Force
```

**Unix/Mac:**
```bash
# Find and kill in one command
lsof -ti:3847 | xargs kill -9
```

## References
- Node.js `child_process.execSync`: https://nodejs.org/api/child_process.html#child_processexecsynccommand-options
- Windows netstat documentation: https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/netstat
- Unix lsof manual: https://man7.org/linux/man-pages/man8/lsof.8.html
