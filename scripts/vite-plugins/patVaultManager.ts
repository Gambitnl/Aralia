/**
 * PAT Vault Manager — credential MAP for the agent fleet (misc/pat_vault.html).
 *
 * Tracks WHERE each token lives and its live presence/status — NEVER the raw
 * secret value. Tokens themselves stay in user env vars and ~/.qoder-pats/*.txt
 * (outside the repo, since the daily snapshot commits .agent/). This endpoint
 * reports only: is the env var set? does the backing file exist? plus a masked
 * tail (last 5 chars) so you can confirm the right token is in place without
 * exposing it.
 *
 *   GET /api/pat-status → { credentials: [{ id, label, account, kind, envVar,
 *                            file, purpose, scopes, docsUrl, envSet, fileExists,
 *                            maskedTail, status }] }
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile, spawn } from 'child_process';

interface CredDef {
  id: string;
  label: string;
  account: string;
  kind: 'PAT' | 'API key' | 'OAuth' | 'subscription';
  envVar?: string;              // env var that should hold it (presence-checked)
  file?: string;                // backing file (presence-checked); ~ expands to home
  purpose: string;
  scopes?: string;
  docsUrl?: string;
  credentialManager?: boolean; // Windows Credential Manager target is derived from the credential id.
  /** baseline status when there's nothing to presence-check (OAuth/subscription) */
  staticStatus?: 'active' | 'pending' | 'missing' | 'n/a';
}

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const expand = (p?: string) => (p ? p.replace(/^~/, HOME) : '');
const CREDENTIAL_MANAGER_PREFIX = 'AraliaPATVault';

// ============================================================================
// Windows Credential Manager Helpers
// ============================================================================
// This section talks to Windows' built-in generic credential store through
// cmdkey.exe. Windows encrypts those entries for the current user through DPAPI.
// The vault only checks whether an entry exists and can write/delete it; cmdkey
// does not expose the saved secret back to this page, which preserves the
// existing "presence, not value" safety model.
// ============================================================================

export function credentialManagerTarget(id: string): string {
  return `${CREDENTIAL_MANAGER_PREFIX}:${id}`;
}

function credentialManagerSupported(): boolean {
  return process.platform === 'win32';
}

function runCmdkey(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('cmdkey.exe', args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function credentialManagerEntryExists(id: string): Promise<boolean> {
  if (!credentialManagerSupported()) return false;
  try {
    const { stdout } = await runCmdkey(['/list']);
    return stdout.includes(credentialManagerTarget(id));
  } catch {
    return false;
  }
}

async function writeCredentialManagerEntry(id: string, secret: string): Promise<void> {
  if (!credentialManagerSupported()) {
    throw new Error('Windows Credential Manager is only available on Windows.');
  }
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error('Token is empty.');
  }
  await runCmdkey([
    '/generic:' + credentialManagerTarget(id),
    '/user:' + id,
    '/pass:' + trimmed,
  ]);
}

async function deleteCredentialManagerEntry(id: string): Promise<void> {
  if (!credentialManagerSupported()) {
    throw new Error('Windows Credential Manager is only available on Windows.');
  }
  await runCmdkey(['/delete:' + credentialManagerTarget(id)]);
}

function openWindowsCredentialManager(): Promise<void> {
  if (!credentialManagerSupported()) {
    throw new Error('Windows Credential Manager is only available on Windows.');
  }
  return new Promise((resolve, reject) => {
    // Open the real Windows UI because this action is explicitly requested from
    // the local operator dashboard. control.exe may return quickly while the
    // Control Panel window stays open; that is a successful launch.
    const child = spawn('control.exe', ['/name', 'Microsoft.CredentialManager'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

// The fleet credential map. Edit here to add/track a credential.
const CREDENTIALS: CredDef[] = [
  {
    id: 'qoder-bob', label: 'Qoder — bob', account: 'bobbenhouzer@gmail.com', kind: 'PAT',
    // Bob's Qoder lane now uses Windows Credential Manager only, so the vault
    // no longer checks the older environment variable or sidecar token file.
    credentialManager: true,
    purpose: 'Browserless Qoder CLI auth (bob lane) · 200/day free Qwen3.7-Max',
    docsUrl: 'https://docs.qoder.com/en/cli/sdk/authentication',
  },
  {
    id: 'qoder-cranenre', label: 'Qoder — cranenre', account: 'cranenre@gmail.com', kind: 'PAT',
    // Cranenre mirrors Bob: Windows Credential Manager is the sole tracked
    // token source, so stale env vars or sidecar files cannot keep driving
    // this lane after it has moved to DPAPI-backed storage.
    credentialManager: true,
    purpose: 'Browserless Qoder CLI auth (cranenre lane) · likely 2nd free Qwen pool',
    docsUrl: 'https://docs.qoder.com/en/cli/sdk/authentication',
  },
  {
    id: 'github-mcp', label: 'GitHub — MCP server', account: 'Gambitnl (gh CLI authed)', kind: 'PAT',
    envVar: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    credentialManager: true,
    purpose: 'Token for the github MCP server in .mcp.json. EMPTY → server crash-loops → CPU spike. Fix B.',
    scopes: 'repo (classic) or fine-grained repo read',
    docsUrl: 'https://github.com/settings/tokens',
  },
  {
    id: 'nvidia', label: 'NVIDIA build', account: 'nvidia developer', kind: 'API key',
    envVar: 'NVIDIA_API_KEY',
    credentialManager: true,
    purpose: 'Free OpenAI-compatible endpoint (DeepSeek/Qwen/Kimi) for OpenCode/Kilo. No card.',
    scopes: 'nvapi-… key', docsUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  {
    id: 'kilo', label: 'Kilo gateway', account: 'cranenre@gmail.com', kind: 'OAuth',
    purpose: '500+ model gateway (incl. claude-fable). Login: kilo auth login.',
    staticStatus: 'pending', docsUrl: 'https://app.kilo.ai',
  },
  {
    id: 'copilot', label: 'GitHub Copilot CLI', account: 'GitHub OAuth', kind: 'OAuth',
    purpose: 'Device-code login (/login). Copilot Free = 50 agent req/mo. No PAT — OAuth only.',
    staticStatus: 'pending', docsUrl: 'https://github.com/settings/copilot',
  },
  {
    id: 'cursor', label: 'Cursor Agent', account: 'Cursor OAuth', kind: 'OAuth',
    purpose: 'agent login (browser). Hobby ~50 premium req/mo shared with IDE.',
    staticStatus: 'pending',
  },
  {
    id: 'anthropic', label: 'Claude Code', account: 'cranenre (Pro)', kind: 'subscription',
    purpose: 'This orchestrator. OAuth subscription (5h + weekly windows).',
    staticStatus: 'active',
  },
  {
    id: 'google', label: 'Gemini / Antigravity', account: 'Google AI Pro', kind: 'OAuth',
    purpose: 'gemini CLI (SUNSET Jun 18) + agy (Antigravity, multi-model). Browser OAuth.',
    staticStatus: 'active',
  },
  {
    id: 'codex', label: 'Codex CLI', account: 'cranenre (ChatGPT Plus)', kind: 'subscription',
    purpose: 'OpenAI Codex. ChatGPT sign-in (5h + weekly windows).',
    staticStatus: 'active',
  },
];

function maskTail(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  return v.length <= 6 ? '••••' : '…' + v.slice(-5);
}

export function statusOf(c: Pick<CredDef, 'staticStatus'>, envSet: boolean, fileExists: boolean, credentialManagerSet: boolean): string {
  if (c.staticStatus) return c.staticStatus;
  if (envSet || fileExists || credentialManagerSet) return 'active';
  return 'missing';
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

function json(res: any, code: number, obj: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function credentialById(id: string): CredDef | undefined {
  return CREDENTIALS.find((credential) => credential.id === id);
}

export const patVaultManager = () => ({
  name: 'pat-vault-manager',
  configureServer(server: { middlewares: { use: (h: (req: any, res: any, next: any) => void) => void } }) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      // Learned-lessons registry (canonical: .agent/orchestration/lessons.json)
      if (urlPath === '/api/lessons') {
        res.setHeader('Content-Type', 'application/json');
        try {
          const raw = fs.readFileSync(path.join(process.cwd(), '.agent', 'orchestration', 'lessons.json'), 'utf8');
          const data = JSON.parse(raw);
          res.end(JSON.stringify({ lessons: data.lessons || [] }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ lessons: [], error: (e as Error).message }));
        }
        return;
      }
      if (urlPath === '/api/pat-credential-manager' && req.method === 'POST') {
        let body: { id?: string; token?: string };
        try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid JSON body' }); }
        const credential = body.id ? credentialById(body.id) : undefined;
        if (!credential || !credential.credentialManager) return json(res, 404, { error: 'credential is not Credential Manager-backed' });
        try {
          await writeCredentialManagerEntry(credential.id, body.token || '');
          return json(res, 200, { ok: true, target: credentialManagerTarget(credential.id) });
        } catch (e) {
          return json(res, 500, { error: (e as Error).message });
        }
      }
      if (urlPath === '/api/pat-credential-manager' && req.method === 'DELETE') {
        let body: { id?: string };
        try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid JSON body' }); }
        const credential = body.id ? credentialById(body.id) : undefined;
        if (!credential || !credential.credentialManager) return json(res, 404, { error: 'credential is not Credential Manager-backed' });
        try {
          await deleteCredentialManagerEntry(credential.id);
          return json(res, 200, { ok: true, target: credentialManagerTarget(credential.id) });
        } catch (e) {
          return json(res, 500, { error: (e as Error).message });
        }
      }
      if (urlPath === '/api/open-credential-manager' && req.method === 'POST') {
        try {
          await openWindowsCredentialManager();
          return json(res, 200, { ok: true });
        } catch (e) {
          return json(res, 500, { error: (e as Error).message });
        }
      }
      if (urlPath !== '/api/pat-status') return next();
      const out = await Promise.all(CREDENTIALS.map(async (c) => {
        const envVal = c.envVar ? process.env[c.envVar] : undefined;
        const envSet = !!(envVal && envVal.trim());
        let fileExists = false;
        let fileVal = '';
        if (c.file) {
          try { fileVal = fs.readFileSync(expand(c.file), 'utf8'); fileExists = !!fileVal.trim(); } catch { /* absent */ }
        }
        const credentialManagerSet = c.credentialManager ? await credentialManagerEntryExists(c.id) : false;
        return {
          id: c.id, label: c.label, account: c.account, kind: c.kind,
          envVar: c.envVar || null, file: c.file || null,
          credentialManager: !!c.credentialManager,
          credentialManagerSet,
          credentialManagerTarget: c.credentialManager ? credentialManagerTarget(c.id) : null,
          credentialManagerSupported: credentialManagerSupported(),
          purpose: c.purpose, scopes: c.scopes || null, docsUrl: c.docsUrl || null,
          envSet, fileExists,
          maskedTail: maskTail(envVal || fileVal),
          status: statusOf(c, envSet, fileExists, credentialManagerSet),
        };
      }));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ credentials: out, generatedAt: Date.now() }));
    });
  },
});
