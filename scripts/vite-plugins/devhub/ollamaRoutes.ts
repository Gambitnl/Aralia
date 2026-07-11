import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import type { DevHubRouteContext } from './routeContext';

export async function handleOllamaRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { json, parsedUrl, urlPath } = ctx;

  // ============================================================================
  // Ollama Dashboard Status Probe Routes
  // ============================================================================
  // This section provides server-side capability to audit the local Ollama
  // installation, process execution state, active ports, memory usage,
  // loaded model parameters, and recent console log outputs.
  // These routes are leveraged by the local Ollama dashboard to poll status.
  // ============================================================================

  // Probe Ollama Process: Audit whether the server process is currently running,
  // and read its active RAM size, handle counts, and path configuration.
  if (urlPath === '/api/ollama-check/process') {
    // Query process list via PowerShell as a native Windows check.
    exec('powershell -NoLogo -Command "Get-Process ollama -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, CPU, WorkingSet, Handles, NPM, PM, Path | ConvertTo-Json -Compress"', (err, stdout) => {
      if (err || !stdout.trim()) {
        // Process not found or PowerShell returned empty output.
        json({ running: false });
      } else {
        try {
          // Parse process metrics returned from PowerShell.
          json({ running: true, process: JSON.parse(stdout.trim()) });
        } catch (e) {
          // Handle JSON parsing edge cases or multiple returned process instances.
          json({ running: true, raw: stdout.trim() });
        }
      }
    });
    return true;
  }

  // Probe Ollama Port: Read active TCP connections bound to the default Ollama
  // port 11434 to check for open sockets and client connections.
  if (urlPath === '/api/ollama-check/port') {
    // Run network inspection command using native Windows PowerShell commands.
    exec('powershell -NoLogo -Command "Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | ConvertTo-Json -Compress"', (err, stdout) => {
      if (err || !stdout.trim()) {
        // No sockets open on this port.
        json({ connections: [] });
      } else {
        try {
          // Parse network status records. Convert single-object outputs into arrays.
          const parsed = JSON.parse(stdout.trim());
          const connections = Array.isArray(parsed) ? parsed : [parsed];
          json({ connections });
        } catch (e) {
          json({ connections: [], raw: stdout.trim() });
        }
      }
    });
    return true;
  }

  // Probe Loaded Models: Reach out to the local Ollama API to see if any
  // language model weights are currently resident in CPU/GPU memory.
  if (urlPath === '/api/ollama-check/models') {
    // Make request directly to Ollama's active model API endpoint.
    fetch('http://localhost:11434/api/ps')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Return model details indicating a responsive service.
        json({ offline: false, ...data });
      })
      .catch(err => {
        // Service is unreachable or returned an error state.
        json({ offline: true, error: err.message });
      });
    return true;
  }

  // Read Log Output: Extract the tail of the local log files to see
  // active API queries, engine load times, and error indicators.
  // Supports "?type=app" (app.log) or "?type=server" (server.log).
  if (urlPath === '/api/ollama-check/logs') {
    try {
      const logType = parsedUrl.searchParams.get('type') === 'server' ? 'server' : 'app';
      const filename = logType === 'server' ? 'server.log' : 'app.log';
      
      // Resolve target path in user's AppData directory on Windows.
      const logPath = path.join(process.env.LOCALAPPDATA || '', 'Ollama', filename);
      if (!fs.existsSync(logPath)) {
        // Log file not created yet (e.g. fresh installation).
        json({ exists: false, lines: [], type: logType });
        return true;
      }
      
      // Read log file tail using raw Node fs functions to avoid locking the file.
      const stat = fs.statSync(logPath);
      const fd = fs.openSync(logPath, 'r');
      const maxBytes = 128 * 1024; // Read last 128KB of the log.
      const readSize = Math.min(maxBytes, stat.size);
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);
      
      // Format raw bytes and split into lines, filtering out empty entries.
      const logContent = buffer.toString('utf8');
      const lines = logContent.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      // Return the last 50 lines of logs.
      json({ exists: true, path: logPath, lines: lines.slice(-50), type: logType });
    } catch (e: any) {
      // Error opening log file or parsing file descriptor (e.g. permission issues).
      json({ exists: false, error: e.message });
    }
    return true;
  }

  return false;
}
