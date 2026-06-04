import path from 'path';
import fs from 'fs';
import { spawn, exec, execSync } from 'child_process';
import type { ProxyOptions } from 'vite';

export const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');
export const MCP_CONFIG = path.resolve(process.cwd(), '.mcp.json');
export const MCP_CLI_ENTRY = path.resolve(process.cwd(), 'node_modules', 'mcp-cli', 'src', 'index.ts');
export const BUN_BIN = process.platform === 'win32'
  ? path.resolve(process.cwd(), 'node_modules', '.bin', 'bun.exe')
  : 'bun';
export const STITCH_TOOL_OVERRIDE = (process.env.STITCH_IMAGE_TOOL || '').trim();
export const STITCH_EXTRA_ARGS = (process.env.STITCH_IMAGE_ARGS || '').trim();

export const PORTRAIT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'public',
  'assets',
  'images',
  'portraits',
  'generated'
);
export const STITCH_GCLOUD_CONFIG = process.env.CLOUDSDK_CONFIG
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.stitch-mcp', 'config') : '');

export const formatProxyTarget = (target: ProxyOptions['target']): string => {
  if (!target) return 'unknown';
  if (typeof target === 'string') return target;
  return target.toString();
};

export const execAsync = (cmd: string, opts: any): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    exec(cmd, opts, (error: any, stdout: string, stderr: string) => {
      if (error) {
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

export const readBody = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += String(chunk);
      // Guardrail for accidental large payloads.
      if (data.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        try { req.destroy(); } catch { /* ignore */ }
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

export const stripMarkdownInline = (value: string): string =>
  String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const toProjectSlug = (value: string): string =>
  stripMarkdownInline(value)
    .replace(/\([^)]*\)/g, '')
    .replace(/&/g, ' and ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toProjectDisplayName = (slug: string): string => {
  const replacements: Record<string, string> = {
    '3d': '3D',
    ui: 'UI',
    phb2024: 'PHB 2024',
    world3d: 'World 3D',
    worldsim: 'WorldSim',
    realmsmith: 'RealmSmith',
    saveload: 'SaveLoad',
  };

  return String(slug || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => replacements[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const projectSlugFromNorthStarPath = (value: string): string | null => {
  const normalized = String(value || '').replace(/\\/g, '/');
  const match = normalized.match(/docs\/projects\/([^/]+)\/NORTH_STAR\.md/i);
  return match ? match[1] : null;
};

export async function findFreePort(): Promise<number> {
  const { createServer } = await import('net');
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function waitForPort(port: number, maxMs = 8000): Promise<void> {
  const { createConnection } = await import('net');
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const ok = await new Promise<boolean>(resolve => {
      const sock = createConnection(port, '127.0.0.1');
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.setTimeout(150, () => { sock.destroy(); resolve(false); });
    });
    if (ok) return;
  }
  throw new Error(`Service did not start within ${maxMs}ms`);
}

export function sanitizePromptText(input: string, maxLength = 500): string {
  if (!input) return '';
  let sanitized = input.slice(0, maxLength);
  sanitized = sanitized
    .replace(/System Instruction:/gi, '[REDACTED]')
    .replace(/User Prompt:/gi, '[REDACTED]')
    .replace(/Context:/gi, '[REDACTED]')
    .replace(/```/g, "'''")
    .trim();
  return sanitized;
}

export function parseJsonInput(value: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

export function extractJsonFromOutput(output: string): unknown | null {
  const trimmed = String(output || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch { /* ignore */ }
    }
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch { /* ignore */ }
    }
  }
  return null;
}

export function parseToolsFromOutput(output: string): string[] {
  const tools: string[] = [];
  const lines = String(output || '').split('\n');

  for (const line of lines) {
    const match = line.match(/(?:^|\s)([a-z_]+)\s*-/i);
    if (match) tools.push(match[1]);
  }

  return tools;
}

export async function listTools(serverName: string): Promise<string[]> {
  const cmd = `"${MCP_CLI}" --config "${MCP_CONFIG}" ${serverName} -d`;
  const { stdout } = await execAsync(cmd, { shell: true, timeout: 30000, windowsHide: true });
  return parseToolsFromOutput(stdout);
}

export async function callMcpTool(
  server: string,
  tool: string,
  args: Record<string, unknown>,
  timeoutMs = 180000
): Promise<{ stdout: string; stderr: string }> {
  // Use bun + the mcp-cli TS entrypoint to avoid JSON quoting issues on Windows shells.
  // (Passing JSON through cmd/powershell quoting frequently results in mcp-cli receiving the surrounding quotes.)
  return new Promise((resolve, reject) => {
    const child = spawn(
      BUN_BIN,
      [MCP_CLI_ENTRY, '--config', MCP_CONFIG, `${server}/${tool}`, JSON.stringify(args)],
      { shell: false, windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error(`mcp-cli timed out calling ${server}/${tool}.`));
    }, timeoutMs);

    child.stdout?.on('data', (d: any) => { stdout += String(d); });
    child.stderr?.on('data', (d: any) => { stderr += String(d); });
    child.on('error', (e: any) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code: number) => {
      clearTimeout(timer);
      if (code !== 0) {
        const err = new Error(`Command failed: ${BUN_BIN} ${server}/${tool} (exit ${code})\n${stderr.trim()}`);
        (err as any).stdout = stdout;
        (err as any).stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
