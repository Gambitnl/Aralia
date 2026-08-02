import { request as httpRequest } from 'http';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import type { Dirent } from 'fs';
import { Socket } from 'net';
import path from 'path';
import { stripMarkdownInline } from '../utils';
import type { DevHubRouteContext } from './routeContext';

const DEV_SERVER_SCAN_TIMEOUT_MS = 1200;
const DEV_SERVER_SCAN_HOST = '127.0.0.1';
const DEV_SERVER_SCAN_DEFAULT_CONCURRENCY = 24;
const DEV_SERVER_SCAN_MAX_RANGE = 4000;
const DEV_SERVER_SCAN_MIN_PORT = 1;
const DEV_SERVER_SCAN_MAX_PORT = 65535;
const DEV_SERVER_SCAN_TARGETS = {
  3000: 'Core App',
  3010: 'Roadmap',
  3030: 'Dev Hub',
  3040: 'Operator Dashboard',
  3847: 'Codebase Visualizer',
  3001: 'Image Server',
  9222: 'Chrome Debugger',
  11434: 'Ollama',
};
const DEV_SERVER_SCAN_LABELS = Object.keys(DEV_SERVER_SCAN_TARGETS).map((value) => Number(value));

type NodeProcessRow = {
  pid: number;
  name: string;
  parentPid: number;
  parentName: string;
  parentCommandLine: string;
  launcherPid: number;
  launcherName: string;
  launcherCommandLine: string;
  executablePath: string;
  commandLine: string;
};

type AnnotatedNodeProcessRow = NodeProcessRow & {
  debugPort: number | null;
  debugPortAlive: boolean | null;
};

type SymlinkRow = {
  path: string;
  name: string;
  parent: string;
  type: string;
  target: string;
  targetExists: boolean;
  targetDrive: string;
  sizeBytes: number | null;
  sizeLabel: string;
  sizeNote: string;
  category: string;
};

// Process types the dashboard can enumerate. Keys map to the executable names
// Windows reports; the browser requests a comma-separated subset via ?types=.
// Only these hardcoded names ever reach the PowerShell query — the ?types keys
// are looked up here, so no caller-supplied string is ever interpolated.
const PROCESS_TYPE_NAMES: Record<string, string[]> = {
  node: ['node.exe', 'node'],
  cmd: ['cmd.exe'],
  powershell: ['powershell.exe', 'pwsh.exe'],
  conhost: ['conhost.exe'],
  openconsole: ['OpenConsole.exe'],
};
const DEFAULT_PROCESS_NAMES = PROCESS_TYPE_NAMES.node;

const resolveProcessNames = (typesParam: string | null): string[] => {
  if (!typesParam) return DEFAULT_PROCESS_NAMES;
  const names = new Set<string>();
  for (const key of typesParam.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)) {
    for (const name of PROCESS_TYPE_NAMES[key] || []) {
      names.add(name);
    }
  }
  return names.size ? Array.from(names) : DEFAULT_PROCESS_NAMES;
};

// Pull a debugger port out of a command (Chrome DevTools MCP uses
// `--browserUrl http://127.0.0.1:9222`; other tools use
// `--remote-debugging-port 9222`). Used to flag a tool whose target is gone.
const extractDebugPort = (...commands: Array<string | undefined>): number | null => {
  for (const command of commands) {
    const text = String(command || '');
    const browserUrl = text.match(/--browser-?url[=\s]+https?:\/\/[^\s:"']+:(\d{2,5})/i);
    if (browserUrl) return Number(browserUrl[1]);
    const debugPort = text.match(/--remote-debugging-port[=\s]+(\d{2,5})/i);
    if (debugPort) return Number(debugPort[1]);
  }
  return null;
};

const probeTcpPort = (port: number, timeoutMs = 600): Promise<boolean> => new Promise((resolve) => {
  const socket = new Socket();
  let settled = false;
  const finish = (alive: boolean) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    resolve(alive);
  };
  socket.setTimeout(timeoutMs);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
  socket.connect(port, DEV_SERVER_SCAN_HOST);
});

const runCommand = (file: string, args: string[]) => new Promise<string>((resolve, reject) => {
  execFile(file, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(String(stdout || ''));
  });
});

const formatSizeLabel = (bytes: number | null): string => {
  if (bytes === null) return 'unknown';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const normalizeWindowsPath = (value: string) => path.win32.normalize(value).replace(/\//g, '\\');

const normalizeLinkTarget = (target: string) => {
  const normalized = normalizeWindowsPath(target || '');
  return normalized.startsWith('\\??\\') ? normalized.slice(4) : normalized;
};

const pathKey = (value: string) => normalizeWindowsPath(value).toLowerCase();

const isPathUnder = (candidate: string, parent: string) => {
  const candidateKey = pathKey(candidate);
  const parentKey = pathKey(parent);
  return candidateKey === parentKey || candidateKey.startsWith(`${parentKey.endsWith('\\') ? parentKey : `${parentKey}\\`}`);
};

type RecursiveDirent = Dirent<string> & {
  parentPath?: string;
  path?: string;
};

const getDirentParent = (entry: RecursiveDirent, fallback: string) => entry.parentPath || entry.path || fallback;

const sumFileSizes = async (filePaths: string[], concurrency = 64): Promise<number> => {
  let index = 0;
  let bytes = 0;

  const worker = async () => {
    while (index < filePaths.length) {
      const filePath = filePaths[index];
      index += 1;
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isDirectory()) bytes += stats.size;
      } catch {
        // Ignore files that disappear or cannot be read during a live scan.
      }
    }
  };

  const workerCount = Math.min(concurrency, Math.max(1, filePaths.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return bytes;
};

const measureDirectoryWithNode = async (directoryPath: string): Promise<number> => {
  let entries: RecursiveDirent[];
  try {
    entries = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true }) as RecursiveDirent[];
  } catch {
    return 0;
  }

  const skippedDirectories: string[] = [];
  const filePaths: string[] = [];
  for (const entry of entries) {
    const entryPath = path.win32.join(getDirentParent(entry, directoryPath), entry.name);
    if (skippedDirectories.some((skippedPath) => isPathUnder(entryPath, skippedPath))) continue;
    if (entry.isSymbolicLink()) {
      skippedDirectories.push(entryPath);
      continue;
    }
    if (!entry.isDirectory()) filePaths.push(entryPath);
  }

  return sumFileSizes(filePaths);
};

const measureDirectoryWithRobocopy = async (directoryPath: string): Promise<number> => new Promise((resolve, reject) => {
  execFile(
    'robocopy.exe',
    [directoryPath, 'NUL', '/L', '/S', '/BYTES', '/XJ', '/R:0', '/W:0', '/NFL', '/NDL', '/NJH'],
    { windowsHide: true, maxBuffer: 512 * 1024 },
    (error, stdout, stderr) => {
      const exitCode = typeof (error as { code?: unknown } | null)?.code === 'number'
        ? Number((error as { code: number }).code)
        : 0;
      if (error && exitCode > 7) {
        reject(error);
        return;
      }

      const output = `${stdout || ''}\n${stderr || ''}`;
      const bytesMatch = output.match(/^\s*Bytes\s*:\s*([\d,]+)/m);
      if (!bytesMatch) {
        reject(new Error('Could not parse robocopy byte summary'));
        return;
      }

      resolve(Number(bytesMatch[1].replace(/,/g, '')));
    },
  );
});

const measureDirectoryNoLinks = async (directoryPath: string): Promise<number> => {
  if (process.platform === 'win32') {
    try {
      return await measureDirectoryWithRobocopy(directoryPath);
    } catch {
      // Fall back to the Node walker if robocopy is unavailable or returns an unexpected summary.
    }
  }

  return measureDirectoryWithNode(directoryPath);
};

const getCompatibilityLinkParents = (userProfile: string) => new Map<string, Set<string>>([
  [pathKey(userProfile), new Set([
    'application data',
    'cookies',
    'local settings',
    'my documents',
    'nethood',
    'printhood',
    'recent',
    'sendto',
    'start menu',
    'templates',
  ])],
  [pathKey(path.win32.join(userProfile, 'AppData', 'Local')), new Set([
    'application data',
    'history',
    'temporary internet files',
  ])],
  [pathKey(path.win32.join(userProfile, 'AppData', 'Roaming')), new Set([
    'application data',
  ])],
]);

const listProfileSymlinks = async (): Promise<SymlinkRow[]> => {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  if (!userProfile) return [];

  if (process.platform !== 'win32') {
    return [];
  }

  const scanRoots = [
    userProfile,
    path.win32.join(userProfile, 'AppData', 'Local'),
    path.win32.join(userProfile, 'AppData', 'Roaming'),
  ];
  const compatibilityLinkParents = getCompatibilityLinkParents(userProfile);
  const profileOnG = path.win32.join('G:\\', 'Users', path.win32.basename(userProfile));
  const rows: SymlinkRow[] = [];

  for (const root of scanRoots) {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;

      const sourcePath = path.win32.join(root, entry.name);
      let target = '';
      try {
        target = normalizeLinkTarget(await fs.readlink(sourcePath));
      } catch {
        // Keep the row visible even if Windows cannot resolve its target.
      }

      const knownCompatibilityNames = compatibilityLinkParents.get(pathKey(root));
      const isWindowsCompatibilityLink = Boolean(knownCompatibilityNames?.has(entry.name.toLowerCase()))
        && Boolean(target)
        && isPathUnder(target, userProfile);
      let targetExists = false;
      let targetIsDirectory = false;
      let sizeBytes: number | null = null;
      let sizeNote = '';

      if (isWindowsCompatibilityLink) {
        targetExists = true;
        targetIsDirectory = true;
        sizeBytes = 0;
        sizeNote = 'Compatibility alias; size belongs to its target folder.';
      } else if (target) {
        try {
          const targetStats = await fs.stat(target);
          targetExists = true;
          targetIsDirectory = targetStats.isDirectory();
          if (targetIsDirectory) {
            sizeBytes = await measureDirectoryNoLinks(target);
            sizeNote = 'Target folder, excluding nested reparse points.';
          } else {
            sizeBytes = targetStats.size;
            sizeNote = 'Target file.';
          }
        } catch {
          targetExists = false;
        }
      }

      const targetDrive = target.match(/^[A-Za-z]:/)?.[0].toUpperCase() || '';
      const category = isPathUnder(target, profileOnG)
        ? 'G drive offload'
        : isPathUnder(target, userProfile)
          ? isWindowsCompatibilityLink
            ? 'Windows compatibility link'
            : 'Profile redirect'
          : 'System or app link';

      rows.push({
        path: sourcePath,
        name: entry.name,
        parent: root,
        type: targetIsDirectory ? 'Junction' : 'Symlink',
        target,
        targetExists,
        targetDrive,
        sizeBytes,
        sizeLabel: isWindowsCompatibilityLink ? '0 KB link' : formatSizeLabel(sizeBytes),
        sizeNote,
        category,
      });
    }
  }

  return rows.sort((left, right) => left.path.localeCompare(right.path));
};

// Read small JSON request bodies for local dashboard mutation routes. The dev
// hub API is intentionally lightweight and does not install a body parser, so
// this keeps destructive actions explicit and bounded to tiny payloads.
const readJsonBody = (req: any, maxBytes = 64 * 1024) => new Promise<any>((resolve, reject) => {
  let body = '';
  req.setEncoding?.('utf8');
  req.on('data', (chunk: string) => {
    body += String(chunk || '');
    if (body.length > maxBytes) {
      reject(new Error('Request body is too large.'));
      req.destroy?.();
    }
  });
  req.on('end', () => {
    if (!body.trim()) {
      resolve({});
      return;
    }
    try {
      resolve(JSON.parse(body));
    } catch {
      reject(new Error('Request body must be valid JSON.'));
    }
  });
  req.on('error', reject);
});

// This dashboard runs from the local Vite process, which can inspect the host
// process table. Keeping the query here (instead of in the browser) preserves
// the existing static dashboard approach while never exposing a mutation route.
const listNodeProcesses = async (names: string[] = DEFAULT_PROCESS_NAMES): Promise<NodeProcessRow[]> => {
  if (process.platform === 'win32') {
    const namesLiteral = names.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
    const script = [
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$targetNames = @(${namesLiteral})`,
      "$all = Get-CimInstance Win32_Process",
      '$byId = @{}',
      'foreach ($process in $all) { $byId[[int]$process.ProcessId] = $process }',
      '$nodes = @($all | Where-Object { $targetNames -icontains $_.Name } | ForEach-Object {',
      '  $parent = $byId[[int]$_.ParentProcessId]',
      '  $launcher = if ($parent) { $byId[[int]$parent.ParentProcessId] } else { $null }',
      '  [PSCustomObject]@{',
      '    pid = [int]$_.ProcessId',
      '    name = [string]$_.Name',
      '    parentPid = [int]$_.ParentProcessId',
      '    parentName = if ($parent) { [string]$parent.Name } else { \'<exited>\' }',
      '    parentCommandLine = if ($parent) { [string]$parent.CommandLine } else { \'\' }',
      '    launcherPid = if ($parent) { [int]$parent.ParentProcessId } else { 0 }',
      '    launcherName = if ($launcher) { [string]$launcher.Name } else { \'<exited>\' }',
      '    launcherCommandLine = if ($launcher) { [string]$launcher.CommandLine } else { \'\' }',
      '    executablePath = [string]$_.ExecutablePath',
      '    commandLine = [string]$_.CommandLine',
      '  }',
      '})',
      "if ($nodes.Count -eq 0) { '[]' } else { $nodes | ConvertTo-Json -Compress -Depth 3 }",
    ].join('\n');
    const output = await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    const parsed = JSON.parse(output.trim() || '[]');
    return (Array.isArray(parsed) ? parsed : [parsed]).map((row: Partial<NodeProcessRow>) => ({
      pid: Number(row.pid) || 0,
      name: String(row.name || ''),
      parentPid: Number(row.parentPid) || 0,
      parentName: String(row.parentName || '<exited>'),
      parentCommandLine: String(row.parentCommandLine || ''),
      launcherPid: Number(row.launcherPid) || 0,
      launcherName: String(row.launcherName || '<exited>'),
      launcherCommandLine: String(row.launcherCommandLine || ''),
      executablePath: String(row.executablePath || ''),
      commandLine: String(row.commandLine || ''),
    }));
  }

  const wantedBases = new Set(names.map((value) => value.replace(/\.exe$/i, '').toLowerCase()));
  const baseName = (value: string) => (String(value || '').split(/[\\/]/).pop() || '');
  const output = await runCommand('ps', ['-axo', 'pid=,ppid=,comm=,args=']);
  const processes = output.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
    if (!match) return null;
    return { pid: Number(match[1]), parentPid: Number(match[2]), executablePath: match[3], commandLine: match[4] || match[3] };
  }).filter((row): row is { pid: number; parentPid: number; executablePath: string; commandLine: string } => Boolean(row));
  const processesByPid = new Map(processes.map((row) => [row.pid, row]));
  return processes
    .filter((row) => wantedBases.has(baseName(row.executablePath).replace(/\.exe$/i, '').toLowerCase())
      || (wantedBases.has('node') && /(^|\s)node(?:\s|$)/i.test(row.commandLine)))
    .map((row) => {
      const parent = processesByPid.get(row.parentPid);
      const launcher = parent ? processesByPid.get(parent.parentPid) : undefined;
      return {
        ...row,
        name: baseName(row.executablePath),
        parentName: parent?.executablePath || '<exited>',
        parentCommandLine: parent?.commandLine || '',
        launcherPid: parent?.parentPid || 0,
        launcherName: launcher?.executablePath || '<exited>',
        launcherCommandLine: launcher?.commandLine || '',
      };
    });
};

// The page may request many process types at once; keeping this helper on the
// server ensures kill validation uses the same live process table as the read
// endpoint instead of trusting stale browser rows.
const listAnnotatedProcesses = async (names: string[]): Promise<AnnotatedNodeProcessRow[]> => {
  const processes = await listNodeProcesses(names);
  const debugPorts = new Set<number>();
  for (const proc of processes) {
    const port = extractDebugPort(proc.commandLine, proc.parentCommandLine, proc.launcherCommandLine);
    if (port) debugPorts.add(port);
  }
  const debugPortAlive = new Map<number, boolean>();
  await Promise.all([...debugPorts].map(async (port) => {
    debugPortAlive.set(port, await probeTcpPort(port));
  }));
  return processes.map((proc) => {
    const debugPort = extractDebugPort(proc.commandLine, proc.parentCommandLine, proc.launcherCommandLine);
    return {
      ...proc,
      debugPort: debugPort ?? null,
      debugPortAlive: debugPort ? (debugPortAlive.get(debugPort) ?? null) : null,
    };
  });
};

// Bulk-kill is intentionally limited to rows that still have a positive leak
// signal. Protected local runtimes are refused even if their parent/debug state
// looks odd, because stopping them can break the dev server or the active agent.
const isProtectedProcess = (proc: AnnotatedNodeProcessRow) => {
  const chain = `${proc.commandLine}\n${proc.parentCommandLine}\n${proc.launcherCommandLine}`.toLowerCase();
  return proc.pid === process.pid
    || /vite(?:\.js)?|\bvite\b/.test(chain)
    || /tools[\\/]agora[\\/]server\.mjs/.test(chain)
    || /openai[\\/]codex|codex[\\/]runtimes|cua_node|codex-command-runner/.test(chain);
};

const isLikelyLeakedProcess = (proc: AnnotatedNodeProcessRow) => {
  if (isProtectedProcess(proc)) return false;
  if (proc.debugPortAlive === false && Number.isFinite(Number(proc.debugPort))) return true;
  return String(proc.parentName || '') === '<exited>';
};

const killProcessTree = async (pid: number) => {
  if (process.platform === 'win32') {
    await runCommand('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  process.kill(pid, 'SIGTERM');
};

const toTitleFromHtml = (value: string) => {
  const match = String(value || '').match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return stripMarkdownInline(match[1]).replace(/\s+/g, ' ').trim();
};

const buildScanTargetsFromRange = (start: number, end: number, includeKnown = true) => {
  const safeStart = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Math.floor(start || DEV_SERVER_SCAN_MIN_PORT)));
  const safeEnd = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Math.floor(end || DEV_SERVER_SCAN_MAX_PORT)));
  const fromPort = Math.min(safeStart, safeEnd);
  const toPort = Math.max(safeStart, safeEnd);

  return Array.from({ length: Math.max(0, toPort - fromPort + 1) }, (_, index) => {
    const port = fromPort + index;
    return {
      port,
      label: includeKnown && DEV_SERVER_SCAN_LABELS.includes(port)
        ? (DEV_SERVER_SCAN_TARGETS as Record<number, string>)[port]
        : 'Unknown service',
      expectedUrl: `http://${DEV_SERVER_SCAN_HOST}:${port}/`,
    };
  });
};

const buildScanTargets = (includeKnown = true, start?: number, end?: number, scanAll = false) => {
  if (scanAll) {
    return buildScanTargetsFromRange(DEV_SERVER_SCAN_MIN_PORT, DEV_SERVER_SCAN_MAX_PORT, includeKnown);
  }
  return buildScanTargetsFromRange(start ?? DEV_SERVER_SCAN_MIN_PORT, end ?? DEV_SERVER_SCAN_MIN_PORT, includeKnown);
};

export const probeHttpUrl = async (
  target: { port: number; label: string; expectedUrl: string; },
  checkedPath = '/',
  timeoutMs = DEV_SERVER_SCAN_TIMEOUT_MS,
) => {
  const checkedUrl = `http://${DEV_SERVER_SCAN_HOST}:${target.port}${checkedPath}`;
  const startMs = Date.now();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEV_SERVER_SCAN_TIMEOUT_MS;
  // Absolute ceiling on how long a single probe may run. A server that streams
  // a body forever (or answers very slowly) must never stall the probe, because
  // one stuck probe blocks its scan worker, which blocks Promise.all, which
  // hangs the whole chunk and freezes the scan. 2x the socket timeout, floored.
  const hardDeadlineMs = Math.max(2000, timeout * 2);

  return new Promise<any>((resolve) => {
    let settled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let request: any = null;
    let liveResponse: any = null;
    let liveTitle = '';

    const settle = (result: any) => {
      if (settled) return;
      settled = true;
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      try {
        request?.destroy();
      } catch {
        // Ignore teardown errors; the probe result is already decided.
      }
      resolve(result);
    };

    const settleActive = (response: any, title: string) => {
      settle({
        port: target.port,
        label: target.label,
        expectedUrl: target.expectedUrl,
        active: true,
        activeUrl: checkedUrl,
        checkedUrl,
        checkedPath,
        httpStatus: Number(response.statusCode) || 0,
        httpStatusText: String(response.statusMessage || ''),
        responseMs: Date.now() - startMs,
        title,
      });
    };

    const settleInactive = (message: string) => {
      settle({
        port: target.port,
        label: target.label,
        expectedUrl: target.expectedUrl,
        active: false,
        checkedUrl,
        checkedPath,
        error: message || 'Request failed',
        responseMs: Date.now() - startMs,
      });
    };

    deadlineTimer = setTimeout(() => {
      // A listening HTTP server that answered with headers is "active" even if
      // its body never ended; otherwise the deadline means no response at all.
      if (liveResponse) {
        settleActive(liveResponse, liveTitle);
      } else {
        settleInactive('Probe exceeded hard deadline.');
      }
    }, hardDeadlineMs);

    request = httpRequest(
      {
        method: 'GET',
        host: DEV_SERVER_SCAN_HOST,
        port: target.port,
        path: checkedPath,
        headers: {
          'User-Agent': 'Aralia-Active-Dev-Server-Scanner/1.0',
        },
        timeout,
      },
      (response: any) => {
        liveResponse = response;
        let responseBody = '';
        let bytesRead = 0;
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          const text = String(chunk || '');
          bytesRead += text.length;
          if (!liveTitle && responseBody.length < 4096) {
            responseBody += text;
            liveTitle = toTitleFromHtml(responseBody);
          }
          // We only need the status line and the <title>. Resolve as soon as we
          // have the title or have seen enough of the head, then tear the stream
          // down. Destroying a response emits 'close', not 'end', so we settle
          // here rather than wait for 'end' — which never comes after a destroy,
          // and never comes at all for a server that streams forever. Waiting on
          // 'end' was the original hang.
          if (liveTitle || bytesRead >= 4096) {
            settleActive(response, liveTitle);
            response.destroy();
          }
        });
        // Every terminal outcome after headers means the port is live. Settling
        // active on all of them guarantees the probe always resolves.
        response.on('end', () => settleActive(response, liveTitle));
        response.on('close', () => settleActive(response, liveTitle));
        response.on('aborted', () => settleActive(response, liveTitle));
        response.on('error', () => settleActive(response, liveTitle));
        response.resume();
      },
    );

    request.on('error', (error: any) => {
      settleInactive(error?.message || 'Request failed');
    });

    request.on('timeout', () => {
      request.destroy(new Error('Probe request timed out.'));
    });

    request.end();
  });
};

const probeWebSocketUpgrade = async (target: { port: number; }, timeoutMs = DEV_SERVER_SCAN_TIMEOUT_MS) => {
  const secWebSocketKey = 'dGhlIHNhbXBsZSBub25jZQ==';
  const socket = new Socket();
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEV_SERVER_SCAN_TIMEOUT_MS;
  const timeout = setTimeout(() => socket.destroy(new Error('WebSocket probe timed out.')), safeTimeout);
  return new Promise<{ upgradeProbeStatus?: number; upgradeProbeError?: string }>((resolve) => {
    let handled = false;
    let responseData = '';
    const finish = (payload: { upgradeProbeStatus?: number; upgradeProbeError?: string; }) => {
      if (handled) return;
      handled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(payload);
    };

    socket.connect(target.port, DEV_SERVER_SCAN_HOST, () => {
      const requestLines = [
        'GET / HTTP/1.1',
        `Host: ${DEV_SERVER_SCAN_HOST}:${target.port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${secWebSocketKey}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ];
      socket.write(requestLines.join('\r\n'));
    });

    socket.on('data', (chunk: Buffer) => {
      responseData += chunk.toString('utf8');
      const match = responseData.match(/^HTTP\/\d+\.\d+\s+(\d+)\b/);
      if (!match) return;
      const status = Number(match[1]);
      if (Number.isFinite(status)) {
        finish({ upgradeProbeStatus: status });
      } else {
        finish({ upgradeProbeError: 'Invalid upgrade response.' });
      }
    });

    socket.on('error', (error: any) => {
      finish({ upgradeProbeError: error?.message || 'WebSocket probe failed.' });
    });
    socket.on('close', () => {
      finish({});
    });
  });
};

const scanDevServer = async (target: { port: number; label: string; expectedUrl: string; }) => {
  const base = await probeHttpUrl(target);
  if (!base.active) return base;
  if (base.httpStatus === 426) {
    const upgrade = await probeWebSocketUpgrade(target, DEV_SERVER_SCAN_TIMEOUT_MS);
    return {
      ...base,
      protocolProbe: upgrade.upgradeProbeStatus === 101 ? 'websocket' : '',
      upgradeProbeStatus: upgrade.upgradeProbeStatus,
      upgradeProbeError: upgrade.upgradeProbeError,
    };
  }
  return base;
};

const scanDevServerTargets = async (targets: Array<{ port: number; label: string; expectedUrl: string; }>, concurrency = DEV_SERVER_SCAN_DEFAULT_CONCURRENCY) => {
  const results: Array<any> = [];
  const limit = Math.max(1, Math.min(200, Number.isFinite(concurrency) ? Math.floor(concurrency) : DEV_SERVER_SCAN_DEFAULT_CONCURRENCY));
  let index = 0;

  const worker = async () => {
    while (index < targets.length) {
      const target = targets[index++];
      results.push(await scanDevServer(target));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, targets.length) }, () => worker())
  );
  return results.sort((left: any, right: any) => left.port - right.port);
};

export async function handleDevServerRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json, parsedUrl, urlPath } = ctx;

  if (urlPath === '/api/dev/symlinks' || urlPath === '/Aralia/api/dev/symlinks') {
    try {
      const userProfile = process.env.USERPROFILE || process.env.HOME || '';
      const links = await listProfileSymlinks();
      json({
        scannedAt: new Date().toISOString(),
        count: links.length,
        offloadedCount: links.filter((link) => link.category === 'G drive offload').length,
        roots: [
          userProfile,
          `${userProfile}\\AppData\\Local`,
          `${userProfile}\\AppData\\Roaming`,
        ],
        links,
      });
    } catch (error) {
      json({ error: `Could not scan symlinks: ${String(error)}` }, 500);
    }
    return true;
  }

  if (urlPath === '/api/dev/node-processes/kill-likely-leaked' || urlPath === '/Aralia/api/dev/node-processes/kill-likely-leaked') {
    if (String(req.method || 'GET').toUpperCase() !== 'POST') {
      json({ error: 'Use POST to kill likely leaked processes.' }, 405);
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const requestedPids = Array.isArray(body?.pids) ? body.pids : [];
      const wantedPids = new Set<number>(
        requestedPids
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0 && value !== process.pid),
      );
      if (!wantedPids.size) {
        json({ error: 'No valid process IDs were supplied.' }, 400);
        return true;
      }

      const processes = await listAnnotatedProcesses(resolveProcessNames(parsedUrl.searchParams.get('types')));
      const processByPid = new Map(processes.map((proc) => [proc.pid, proc]));
      const killed: Array<{ pid: number; name: string }> = [];
      const skipped: Array<{ pid: number; reason: string }> = [];

      for (const pid of wantedPids) {
        const proc = processByPid.get(pid);
        if (!proc) {
          skipped.push({ pid, reason: 'Process was not found in the latest snapshot.' });
          continue;
        }
        if (!isLikelyLeakedProcess(proc)) {
          skipped.push({ pid, reason: 'Process no longer matches the server-side likely-leaked rules.' });
          continue;
        }
        try {
          await killProcessTree(pid);
          killed.push({ pid, name: proc.name });
        } catch (error) {
          skipped.push({ pid, reason: `Kill failed: ${String(error)}` });
        }
      }

      json({
        killed,
        skipped,
        requestedCount: wantedPids.size,
        killedCount: killed.length,
        skippedCount: skipped.length,
      });
    } catch (error) {
      json({ error: `Could not kill likely leaked processes: ${String(error)}` }, 500);
    }
    return true;
  }

  if (urlPath === '/api/dev/node-processes' || urlPath === '/Aralia/api/dev/node-processes') {
    try {
      const names = resolveProcessNames(parsedUrl.searchParams.get('types'));
      const annotated = await listAnnotatedProcesses(names);
      json({
        scannedAt: new Date().toISOString(),
        count: annotated.length,
        processes: annotated.sort((left, right) => left.pid - right.pid),
      });
    } catch (error) {
      json({ error: `Could not inspect processes: ${String(error)}` }, 500);
    }
    return true;
  }

  if (urlPath === '/api/dev/active-servers' || urlPath === '/Aralia/api/dev/active-servers') {
    try {
      const rawStart = Number(parsedUrl.searchParams.get('start'));
      const rawEnd = Number(parsedUrl.searchParams.get('end'));
      const rawRangeLimit = Number(parsedUrl.searchParams.get('rangeLimit'));
      const includeKnown = parsedUrl.searchParams.get('includeKnown') !== '0';
      const scanAll = parsedUrl.searchParams.get('scanAll') === '1';
      const concurrency = Number(parsedUrl.searchParams.get('concurrency'));
      const requestedLimit = Number.isFinite(rawRangeLimit) ? Math.floor(rawRangeLimit) : DEV_SERVER_SCAN_MAX_RANGE;
      const rangeLimit = Math.max(1, Math.min(DEV_SERVER_SCAN_MAX_RANGE, requestedLimit));
      const startPort = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Number.isFinite(rawStart) ? Math.floor(rawStart) : 3000));
      const endPort = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Number.isFinite(rawEnd) ? Math.floor(rawEnd) : 3100));

      if (!scanAll && Math.abs(endPort - startPort) + 1 > DEV_SERVER_SCAN_MAX_RANGE) {
        json({
          error: `Requested range is too large. Increase rangeLimit, use scanAll=1, or reduce end-start+1 to <= ${DEV_SERVER_SCAN_MAX_RANGE}.`,
        }, 400);
        return true;
      }

      const resolvedConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : DEV_SERVER_SCAN_DEFAULT_CONCURRENCY;
      const scanRanges: Array<{ start: number; end: number }> = [];
      const serverRows: Array<any> = [];
      const targets: Array<{ port: number; label: string; expectedUrl: string }> = [];
      const scanStart = Math.min(startPort, endPort);
      const scanEnd = Math.max(startPort, endPort);
      if (scanAll) {
        for (let rangeStart = DEV_SERVER_SCAN_MIN_PORT; rangeStart <= DEV_SERVER_SCAN_MAX_PORT; rangeStart += rangeLimit) {
          const rangeEnd = Math.min(rangeStart + rangeLimit - 1, DEV_SERVER_SCAN_MAX_PORT);
          const chunkTargets = buildScanTargetsFromRange(rangeStart, rangeEnd, includeKnown);
          scanRanges.push({ start: rangeStart, end: rangeEnd });
          const scannedChunk = await scanDevServerTargets(chunkTargets, resolvedConcurrency);
          targets.push(...chunkTargets);
          serverRows.push(...scannedChunk);
        }
      } else {
        const chunkTargets = buildScanTargets(includeKnown, scanStart, scanEnd, scanAll);
        scanRanges.push({ start: scanStart, end: scanEnd });
        const scannedChunk = await scanDevServerTargets(chunkTargets, resolvedConcurrency);
        targets.push(...chunkTargets);
        serverRows.push(...scannedChunk);
      }

      json({
        scannedAt: new Date().toISOString(),
        scanTimeoutMs: DEV_SERVER_SCAN_TIMEOUT_MS,
        totalPortsChecked: serverRows.length,
        activeCount: serverRows.filter((server) => Boolean(server.active)).length,
        scanRange: scanAll ? { start: DEV_SERVER_SCAN_MIN_PORT, end: DEV_SERVER_SCAN_MAX_PORT } : { start: scanStart, end: scanEnd },
        includeKnown,
        scannedRanges: scanRanges,
        concurrency: resolvedConcurrency,
        rangeLimit,
        scanAll,
        targets,
        servers: serverRows,
      });
    } catch (error) {
      json({ error: String(error) }, 500);
    }
    return true;
  }

  return false;
}
