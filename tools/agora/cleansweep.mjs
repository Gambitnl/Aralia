#!/usr/bin/env node
/**
 * @file cleansweep.mjs
 * @description Manual, report-first process clean-sweep for this box. Surveys the
 * leaks that pile up during a heavy agent/capture session — duplicate MCP servers
 * (Claude Desktop / Codex respawn them on every reconnect and leave the old copies
 * running), orphaned proof-capture Vite servers, and orphaned Playwright browsers —
 * and lets YOU pick what to kill, one category at a time. A single "reap all" is
 * deliberately NOT the default: the MCP category can only keep the live copy by a
 * newest-spawn heuristic, so you look before you leap.
 *
 * ALWAYS PROTECTED (never killed): the Vite dev server (:3000) and its npm parent,
 * the Agora daemon (:4319) and its npm parent, and the newest spawn of each MCP
 * server (one live copy per type). The AmazonQ language server is reported but
 * never touched — it is a separate editor extension.
 *
 * Usage:
 *   node tools/agora/cleansweep.mjs                 # REPORT only, kills nothing
 *   node tools/agora/cleansweep.mjs --kill mcp      # kill stale MCP duplicates
 *   node tools/agora/cleansweep.mjs --kill capture  # kill orphaned capture Vite servers
 *   node tools/agora/cleansweep.mjs --kill playwright  # kill orphaned Playwright browsers/drivers
 *   node tools/agora/cleansweep.mjs --kill mcp,capture,playwright   # multiple
 *   node tools/agora/cleansweep.mjs --kill all      # every category above (still keep-safe)
 *   flags: --keep-newest N (MCP copies to keep per type, default 1) · --max-age-min N (capture, default 10) · --json
 *
 * Windows-first (PowerShell). Exit 0 always.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const JSON_OUT = has('--json');
const KEEP_NEWEST = Math.max(1, Number(val('--keep-newest', '1')));
const MAX_AGE_MIN = Number(val('--max-age-min', '10'));
const killArg = (val('--kill', '') || '').toLowerCase();
const KILL = new Set(killArg ? killArg.split(',').map((s) => s.trim()).filter(Boolean) : []);
const wants = (cat) => KILL.has('all') || KILL.has(cat);
const PROTECTED_PORTS = new Set([3000, 3040, 4319, 5173]);
const isWin = process.platform === 'win32';

function runPwsh(script) {
  const file = join(tmpdir(), `cleansweep-${process.pid}-${Date.now()}.ps1`);
  writeFileSync(file, script, 'utf8');
  try {
    return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
      { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  } finally { try { unlinkSync(file); } catch { /* ignore */ } }
}

function survey() {
  if (!isWin) return { node: [], servers: [] };
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$now = Get-Date
$live = @{}; Get-CimInstance Win32_Process | ForEach-Object { $live[[int]$_.ProcessId] = $true }
$estab = Get-NetTCPConnection -State Established -LocalAddress 127.0.0.1
$listen = Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1
$node = @()
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  $c = '' + $_.CommandLine
  $created = $_.CreationDate
  $ageMin = if ($created) { [math]::Round(($now - $created).TotalMinutes, 1) } else { 0 }
  $cat = 'other'
  if     ($c -match 'server-github')        { $cat = 'mcp:github' }
  elseif ($c -match 'chrome-devtools-mcp')  { $cat = 'mcp:chrome-devtools' }
  elseif ($c -match 'context7')             { $cat = 'mcp:context7' }
  elseif ($c -match 'playwright.mcp|playwright[\\/]mcp') { $cat = 'mcp:playwright' }
  elseif ($c -match 'run agora|agora[\\/]server|server\\.mjs') { $cat = 'keep:agora' }
  elseif ($c -match 'run dev|[\\/]vite[\\/]|vite\\.js|vite$') { $cat = 'keep:devserver' }
  elseif ($c -match 'AmazonQ')              { $cat = 'amazonq' }
  elseif ($c -match 'playwright')           { $cat = 'pw-driver' }
  elseif ($c -match 'cap-|shoot|vizcap|perf-surfaces|reap-capture|cleansweep') { $cat = 'capture-rig' }
  $short = ($c -replace '.*node_modules[\\/]', '') -replace '.*node\\.exe"?\\s*', ''
  $node += [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; mem = [int64]$_.WorkingSetSize; created = ('' + $created); ageMin = $ageMin; cat = $cat; cmd = $short.Substring(0, [math]::Min(90, $short.Length)) }
}
$servers = @()
foreach ($l in $listen) {
  $port = [int]$l.LocalPort
  if ($port -lt 5150 -or $port -gt 5399) { continue }
  $estCount = ($estab | Where-Object { [int]$_.LocalPort -eq $port }).Count
  $servers += [pscustomobject]@{ port = $port; pid = [int]$l.OwningProcess; established = [int]$estCount }
}
[pscustomobject]@{ node = $node; servers = $servers } | ConvertTo-Json -Depth 4 -Compress
`;
  const raw = runPwsh(ps).trim();
  if (!raw) return { node: [], servers: [] };
  const p = JSON.parse(raw);
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  return { node: arr(p.node), servers: arr(p.servers) };
}

function kill(pid) {
  try {
    if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
    return true;
  } catch { return false; }
}
const mb = (bytes) => Math.round(bytes / (1024 * 1024));

const { node, servers } = survey();

// --- categorize kill candidates (kills nothing yet) ---
const mcpTypes = ['mcp:github', 'mcp:chrome-devtools', 'mcp:context7', 'mcp:playwright'];
const mcpDupes = []; // stale MCP copies beyond the newest KEEP_NEWEST spawn per type
for (const t of mcpTypes) {
  const group = node.filter((n) => n.cat === t).sort((a, b) => new Date(b.created) - new Date(a.created));
  if (!group.length) continue;
  const newest = new Date(group[0].created).getTime();
  // keep every proc within 90s * KEEP_NEWEST of the newest (one full spawn group per keep unit)
  const window = 90_000 * KEEP_NEWEST;
  for (const n of group) if (newest - new Date(n.created).getTime() > window) mcpDupes.push(n);
}
const captureKills = servers.filter((s) => !PROTECTED_PORTS.has(s.port) && s.established === 0);
const pwOrphans = node.filter((n) => (n.cat === 'pw-driver' || n.cat === 'capture-rig') && n.ageMin >= MAX_AGE_MIN);

const cats = {
  mcp: { label: 'Stale MCP duplicates', items: mcpDupes, mem: mcpDupes.reduce((a, n) => a + n.mem, 0) },
  capture: { label: 'Orphaned capture Vite servers (0 conns)', items: captureKills, mem: 0 },
  playwright: { label: 'Idle Playwright drivers / capture rigs', items: pwOrphans, mem: pwOrphans.reduce((a, n) => a + n.mem, 0) },
};

if (JSON_OUT && !KILL.size) { console.log(JSON.stringify({ cats, node, servers }, null, 2)); process.exit(0); }

// --- REPORT ---
const totalNodeMem = node.reduce((a, n) => a + n.mem, 0);
console.log(`\ncleansweep — ${node.length} node procs, ${mb(totalNodeMem)} MB total\n`);
const keptMcp = mcpTypes.map((t) => `${t.replace('mcp:', '')}=${node.filter((n) => n.cat === t).length}`).join(' ');
console.log(`PROTECTED (never killed): dev server :3000, Agora :4319, AmazonQ LSP, newest ${KEEP_NEWEST} spawn/MCP-type`);
console.log(`  MCP live counts: ${keptMcp}\n`);
for (const [key, c] of Object.entries(cats)) {
  const n = c.items.length;
  const memStr = key === 'capture' ? '' : ` (~${mb(c.mem)} MB)`;
  const flag = wants(key) ? '  → KILLING' : `  → run with  --kill ${key}`;
  console.log(`[${key}] ${c.label}: ${n} candidate${n === 1 ? '' : 's'}${memStr}${n ? flag : '  (none)'}`);
  for (const it of c.items.slice(0, 8)) {
    if (key === 'capture') console.log(`      127.0.0.1:${it.port} pid ${it.pid} (0 conns)`);
    else console.log(`      pid ${it.pid} ${mb(it.mem)}MB age ${it.ageMin}m  ${it.cmd}`);
  }
  if (n > 8) console.log(`      … +${n - 8} more`);
}

// --- KILL (only chosen categories) ---
if (KILL.size) {
  let killedCount = 0, killedMem = 0;
  const doKill = (items, memOf) => { for (const it of items) if (kill(it.pid)) { killedCount++; killedMem += memOf(it); } };
  if (wants('mcp')) doKill(mcpDupes, (n) => n.mem);
  if (wants('capture')) doKill(captureKills, () => 0);
  if (wants('playwright')) doKill(pwOrphans, (n) => n.mem);
  console.log(`\nkilled ${killedCount} process(es), freed ~${mb(killedMem)} MB. Re-run bare to confirm.`);
} else {
  console.log(`\nReport only — nothing killed. Add --kill <category> (or --kill all) to act.`);
}
process.exit(0);
