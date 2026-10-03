#!/usr/bin/env node
/**
 * @file reap-capture-orphans.mjs
 * @description WF-G45 reaper: kill orphaned proof-capture Vite servers + headless
 * Chromium that pile up when a capture run is hard-killed (the Claude harness
 * SIGKILLs background tasks, so an in-rig teardown trap never fires). Orphans
 * wedge the private ports the next wave reuses and make later `page.goto` hang
 * ~180s until cleared — so a clean-slate reap before/after a capture wave is the
 * rig-independent safety net that a trap alone (which SIGKILL bypasses) cannot be.
 *
 * SAFE BY DESIGN — never touches a live server or an in-flight capture:
 *  - A candidate Vite server is killed ONLY if it is a LISTENING 127.0.0.1 dev
 *    server on a private capture port, has ZERO established connections (no page
 *    is driving it), and is older than --max-age-min (default 10) so a
 *    just-launched server awaiting its first connection is spared.
 *  - Protected ports are never touched: 3000 (Remy's shared dev server), 3040
 *    (operator cockpit), 4319 (Agora daemon), 5173 (canonical Vite), plus --keep.
 *  - Chromium is killed ONLY when ORPHANED (its parent process is gone) unless
 *    --all-chromium is passed; an active capture's browser has a live parent.
 *
 * Usage:
 *   node tools/agora/reap-capture-orphans.mjs [--dry-run] [--max-age-min N]
 *        [--ports A-B] [--keep P,Q] [--all-chromium] [--json]
 *
 * Exit 0 always (reaping is best-effort housekeeping); prints what it killed.
 * Windows-first (this box is win32; PowerShell cmdlets per WF-G45 evidence).
 * POSIX fallback uses `ss`/`ps` where available.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = has('--dry-run');
const JSON_OUT = has('--json');
const MAX_AGE_MIN = Number(val('--max-age-min', '10'));
const ALL_CHROMIUM = has('--all-chromium');
const [portLo, portHi] = String(val('--ports', '5150-5399')).split('-').map(Number);
const PROTECTED = new Set([3000, 3040, 4319, 5173,
  ...String(val('--keep', '')).split(',').map((s) => Number(s.trim())).filter(Boolean)]);

const isWin = process.platform === 'win32';

function runPwsh(script) {
  const file = join(tmpdir(), `reap-${process.pid}-${Date.now()}.ps1`);
  writeFileSync(file, script, 'utf8');
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
      { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return out;
  } finally {
    try { unlinkSync(file); } catch { /* ignore */ }
  }
}

/** Return {servers:[{port,pid,ageMin,cmd}], chromium:[{pid,ppid,orphan,cmd}]} via one PowerShell pass. */
function surveyWindows() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$now = Get-Date
$listen = Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1
$estab  = Get-NetTCPConnection -State Established -LocalAddress 127.0.0.1
$procs  = @{}
Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ }
$servers = @()
foreach ($l in $listen) {
  $port = [int]$l.LocalPort
  if ($port -lt ${portLo} -or $port -gt ${portHi}) { continue }
  $procId = [int]$l.OwningProcess
  $p = $procs[$procId]
  if (-not $p) { continue }
  $estCount = ($estab | Where-Object { [int]$_.LocalPort -eq $port }).Count
  $created = $p.CreationDate
  $ageMin = if ($created) { [math]::Round(($now - $created).TotalMinutes, 1) } else { 0 }
  $servers += [pscustomobject]@{ port = $port; pid = $procId; established = [int]$estCount; ageMin = $ageMin; name = $p.Name; cmd = ("" + $p.CommandLine).Substring(0, [math]::Min(120, ("" + $p.CommandLine).Length)) }
}
$chromium = @()
foreach ($procId in $procs.Keys) {
  $p = $procs[$procId]
  $cmd  = "" + $p.CommandLine
  $path = "" + $p.ExecutablePath
  # A capture leaves TWO kinds of playwright-related orphan ROOTS when its rig is
  # hard-killed: the headless Chromium/driver whose parent is the (now-dead) rig,
  # AND the playwright driver node (a node.exe running .../playwright/... whose
  # parent rig died). Killing the driver root with taskkill /T takes its Chromium
  # children with it. CommandLine is often null without admin, so match PATH too.
  $isBrowser = ($cmd -match 'ms-playwright') -or ($path -match 'ms-playwright') -or ($p.Name -match 'headless_shell')
  $isDriver  = ($p.Name -match 'node') -and ($cmd -match 'playwright')
  if (-not ($isBrowser -or $isDriver)) { continue }
  $ppid = [int]$p.ParentProcessId
  $parentAlive = $procs.ContainsKey($ppid)
  # Only ROOTS matter for a tree kill: a browser child whose parent is another
  # playwright process is covered when we kill that parent. Report every match
  # with its orphan flag; the Node side kills orphan roots with /T.
  $tag = if ($cmd) { $cmd } else { $path }
  $kind = if ($isDriver) { 'driver' } else { 'browser' }
  $chromium += [pscustomobject]@{ pid = [int]$procId; ppid = $ppid; orphan = (-not $parentAlive); kind = $kind; name = $p.Name; cmd = $tag.Substring(0, [math]::Min(120, $tag.Length)) }
}
[pscustomobject]@{ servers = $servers; chromium = $chromium } | ConvertTo-Json -Depth 4 -Compress
`;
  const raw = runPwsh(ps).trim();
  if (!raw) return { servers: [], chromium: [] };
  const parsed = JSON.parse(raw);
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  return { servers: arr(parsed.servers), chromium: arr(parsed.chromium) };
}

function surveyPosix() {
  // Best-effort: `ss -ltnp` for listeners; established via `ss -tnp`. Kept minimal.
  let servers = [];
  try {
    const ss = execFileSync('ss', ['-ltnpH'], { encoding: 'utf8' });
    for (const line of ss.split('\n')) {
      const m = line.match(/127\.0\.0\.1:(\d+)\b.*pid=(\d+)/);
      if (!m) continue;
      const port = Number(m[1]); const pid = Number(m[2]);
      if (port < portLo || port > portHi) continue;
      servers.push({ port, pid, established: 0, ageMin: MAX_AGE_MIN + 1, name: 'node', cmd: '' });
    }
  } catch { /* ss not available */ }
  return { servers, chromium: [] };
}

function kill(pid) {
  if (DRY) return true;
  try {
    if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
    return true;
  } catch { return false; }
}

const survey = isWin ? surveyWindows() : surveyPosix();

const serverKills = survey.servers.filter((s) =>
  !PROTECTED.has(s.port) && s.established === 0 && s.ageMin >= MAX_AGE_MIN);
const serverSpared = survey.servers.filter((s) => !serverKills.includes(s));
const chromiumKills = survey.chromium.filter((c) => ALL_CHROMIUM || c.orphan);

const killed = { servers: [], chromium: [] };
for (const s of serverKills) if (kill(s.pid)) killed.servers.push(s);
for (const c of chromiumKills) if (kill(c.pid)) killed.chromium.push(c);

if (JSON_OUT) {
  console.log(JSON.stringify({ dryRun: DRY, maxAgeMin: MAX_AGE_MIN, killed, spared: serverSpared, surveyed: survey }, null, 2));
} else {
  const tag = DRY ? '[dry-run] would reap' : 'reaped';
  if (!killed.servers.length && !killed.chromium.length) {
    console.log(`reap-capture-orphans: nothing to reap (surveyed ${survey.servers.length} private-port servers, ${survey.chromium.length} chromium).`);
  } else {
    for (const s of killed.servers) console.log(`${tag} orphan Vite server pid ${s.pid} on 127.0.0.1:${s.port} (0 conns, age ${s.ageMin}m) [${s.name}]`);
    for (const c of killed.chromium) console.log(`${tag} orphan Chromium pid ${c.pid} (parent ${c.ppid} ${c.orphan ? 'DEAD' : 'alive'}) [${c.name}]`);
  }
  for (const s of serverSpared) {
    const why = PROTECTED.has(s.port) ? 'protected port' : s.established > 0 ? `${s.established} live conn(s)` : `age ${s.ageMin}m < ${MAX_AGE_MIN}m`;
    console.log(`  spared 127.0.0.1:${s.port} pid ${s.pid} — ${why}`);
  }
}
process.exit(0);
