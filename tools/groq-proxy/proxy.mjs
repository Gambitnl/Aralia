// tools/groq-proxy/proxy.mjs
// Local dev proxy for the game's "Local proxy" Groq mode.
//
// The browser app (griddel :5190) calls http://localhost:8787/v1/... . This proxy
// reads the Groq key from Windows Credential Manager (AgentMatrix/Groq/GROQ_API_KEY)
// at startup, injects the Authorization header, and forwards to Groq. The key never
// enters the browser, never touches a file, and never reaches git/GitHub.
//
// Run:  node tools/groq-proxy/proxy.mjs   (or: npm run groq-proxy)
// Then in the app pick "Local proxy" mode; the default URL http://localhost:8787/v1
// already matches.
//
// Zero npm deps. Node built-ins + global fetch. Secret is read once, cached in
// memory, and NEVER printed or logged.

import http from 'node:http';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.GROQ_PROXY_PORT || argFlag('--port') || 8787);
const CRED_TARGET = process.env.GROQ_PROXY_CRED || 'AgentMatrix/Groq/GROQ_API_KEY';
const UPSTREAM = 'https://api.groq.com/openai/v1';

function argFlag(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

// --- Windows Credential Manager read (advapi32!CredRead via PowerShell) ---------
function credReadScript(target) {
  return `
$ErrorActionPreference='Stop'
$Target=${JSON.stringify(target)}
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
namespace GP{public static class N{
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct C{public UInt32 Flags;public UInt32 Type;public string TargetName;public string Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 CredentialBlobSize;public IntPtr CredentialBlob;public UInt32 Persist;public UInt32 AttributeCount;public IntPtr Attributes;public string TargetAlias;public string UserName;}
[DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool CredRead(string t,int y,int f,out IntPtr p);
[DllImport("advapi32.dll",SetLastError=true)]public static extern void CredFree(IntPtr b);}}
'@
$p=[IntPtr]::Zero
if([GP.N]::CredRead($Target,1,0,[ref]$p)){
 try{ $c=[Runtime.InteropServices.Marshal]::PtrToStructure($p,[type][GP.N+C]); if($c.CredentialBlobSize -gt 0){ $b=New-Object byte[] $c.CredentialBlobSize; [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob,$b,0,$c.CredentialBlobSize); [Text.Encoding]::Unicode.GetString($b).TrimEnd([char]0) } } finally { [GP.N]::CredFree($p) }
}`;
}

function readWinCred(target) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') { resolve(process.env.GROQ_API_KEY || null); return; }
    const enc = Buffer.from(credReadScript(target), 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', enc],
      { windowsHide: true, timeout: 8000, maxBuffer: 1 << 20 },
      (_e, out) => resolve((out || '').trim() || process.env.GROQ_API_KEY || null));
  });
}

let KEY = null;

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, keyLoaded: !!KEY, credTarget: CRED_TARGET, upstream: UPSTREAM }));
    return;
  }
  if (!url.pathname.startsWith('/v1/')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'not found; use /v1/...' })); return; }
  if (!KEY) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: `no Groq key in Credential Manager target "${CRED_TARGET}"` })); return; }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const upstreamUrl = UPSTREAM + url.pathname.slice('/v1'.length) + url.search;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] || 'application/json', Authorization: `Bearer ${KEY}` },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `upstream request failed: ${e.message}` }));
  }
});

const isMain = process.argv[1] && process.argv[1].endsWith('proxy.mjs');
if (isMain) {
  KEY = await readWinCred(CRED_TARGET);
  server.on('error', (e) => {
    if (e && e.code === 'EADDRINUSE') { console.log(`groq-proxy: :${PORT} already in use — a proxy is already running, nothing to do.`); process.exit(0); }
    console.error('groq-proxy error:', e && e.message); process.exit(1);
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`groq-proxy on http://localhost:${PORT}/v1  ->  ${UPSTREAM}`);
    console.log(KEY ? `key: loaded from Credential Manager "${CRED_TARGET}" (not printed)` : `WARNING: no key found at "${CRED_TARGET}" — requests will 500`);
    console.log('In the app: pick "Local proxy" mode (default URL already matches).');
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); process.exit(0); });
}

export { server, readWinCred };
