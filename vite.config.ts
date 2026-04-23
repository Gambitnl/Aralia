import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, exec, execSync } from 'child_process';
import { WebSocket, WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import {
  buildSpellFieldInventory,
  createSpellFieldInventorySummary,
  querySpellFieldInventory,
  type SpellFieldInventory,
} from './scripts/spellFieldInventory';

/**
 * ARCHITECTURAL CONTEXT:
 * This file is the 'Development Command Center'. It configures the 
 * Vite dev server, proxies, and custom middleware for internal tooling 
 * like the Roadmap, Codebase Visualizer, and AI Portrait Generator.
 *
 * Recent updates focus on 'Tooling Decoupling and Persistence'. 
 * - The Roadmap server logic was moved to a dynamic import to prevent 
 *   server restarts when its logic changes.
 * - Isolated server support was added for Roadmap-only mode.
 * - Node label overrides are now persisted to a local file, allowing 
 *   custom names to survive server restarts.
 * - Enhanced proxy diagnostics were added to help debug connection 
 *   refusal issues in complex multi-server environments.
 * 
 * @file vite.config.ts
 */

const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');
const MCP_CONFIG = path.resolve(process.cwd(), '.mcp.json');
const MCP_CLI_ENTRY = path.resolve(process.cwd(), 'node_modules', 'mcp-cli', 'src', 'index.ts');
const BUN_BIN = process.platform === 'win32'
  ? path.resolve(process.cwd(), 'node_modules', '.bin', 'bun.exe')
  : 'bun';
const STITCH_TOOL_OVERRIDE = (process.env.STITCH_IMAGE_TOOL || '').trim();
const STITCH_EXTRA_ARGS = (process.env.STITCH_IMAGE_ARGS || '').trim();
let cachedStitchImageTool: string | null = null;
let cachedStitchImageToolAt = 0;
const STITCH_TOOL_CACHE_MS = 5 * 60 * 1000;

const PORTRAIT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'public',
  'assets',
  'images',
  'portraits',
  'generated'
);
const STITCH_GCLOUD_CONFIG = process.env.CLOUDSDK_CONFIG
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.stitch-mcp', 'config') : '');

const formatProxyTarget = (target: ProxyOptions['target']): string => {
  if (!target) return 'unknown';
  if (typeof target === 'string') return target;
  return target.toString();
};

const execAsync = (cmd: string, opts: any): Promise<{ stdout: string; stderr: string }> =>
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

const readBody = (req: any): Promise<string> =>
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

// ==================== Codex Run Manager ====================
interface CodexJob {
  proc: ReturnType<typeof spawn> | null; // null between multi-turn continues
  subscribers: Array<(chunk: string) => void>;
  done: boolean;
  exitCode: number | null;
  buffer: string[];
}
const codexJobs = new Map<string, CodexJob>();
const SAFE_SCRIPT_NAME_RE = /^[a-zA-Z0-9:_\-]+$/;
function isSafeScriptName(name: string): boolean {
  return SAFE_SCRIPT_NAME_RE.test(name);
}

// ==================== Codex Chat Manager ====================
interface CodexChatSession {
  proc: ReturnType<typeof spawn> | null;
  ws: WebSocket | null;
  threadId: string | null;
  nextId: number;
  subscribers: Array<(event: string) => void>;
  buffer: string[];
  alive: boolean;
}
const codexChatSessions = new Map<string, CodexChatSession>();

async function findFreePort(): Promise<number> {
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

async function waitForPort(port: number, maxMs = 8000): Promise<void> {
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
  throw new Error(`codex app-server did not start within ${maxMs}ms`);
}

function sanitizePromptText(input: string, maxLength = 500): string {
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

function parseJsonInput(value: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function extractJsonFromOutput(output: string): unknown | null {
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

function parseToolsFromOutput(output: string): string[] {
  const tools: string[] = [];
  const lines = String(output || '').split('\n');

  for (const line of lines) {
    const match = line.match(/(?:^|\s)([a-z_]+)\s*-/i);
    if (match) tools.push(match[1]);
  }

  return tools;
}

async function listTools(serverName: string): Promise<string[]> {
  const cmd = `"${MCP_CLI}" --config "${MCP_CONFIG}" ${serverName} -d`;
  const { stdout } = await execAsync(cmd, { shell: true, timeout: 30000, windowsHide: true });
  return parseToolsFromOutput(stdout);
}

async function resolveStitchImageTool(): Promise<string | null> {
  if (STITCH_TOOL_OVERRIDE) return STITCH_TOOL_OVERRIDE;
  if (cachedStitchImageTool && (Date.now() - cachedStitchImageToolAt) < STITCH_TOOL_CACHE_MS) {
    return cachedStitchImageTool;
  }
  if (!fs.existsSync(MCP_CONFIG)) return null;

  const tools = await listTools('stitch');
  if (!tools.length) return null;

  const imageCandidates = tools.filter((tool) => /image|img|asset|render/i.test(tool));
  const preferred = imageCandidates.find((tool) => /generate|create|render/i.test(tool));

  cachedStitchImageTool = preferred || imageCandidates[0] || tools[0] || null;
  cachedStitchImageToolAt = Date.now();
  return cachedStitchImageTool;
}

async function callMcpTool(
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

function extractUrlFromText(text: string): string | undefined {
  const urlMatch = String(text || '').match(/https?:\/\/\S+/);
  if (urlMatch) return urlMatch[0].replace(/[\s'")]+$/, '');
  return undefined;
}

function extractImagePayload(data: unknown): { imageUrl?: string; imageData?: string; mimeType?: string } | null {
  if (!data || typeof data !== 'object') return null;

  const anyData = data as any;
  const candidates = [anyData, anyData.result, anyData.data, anyData.output];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate.imageUrl === 'string') return { imageUrl: candidate.imageUrl };
    if (typeof candidate.image_url === 'string') return { imageUrl: candidate.image_url };
    if (typeof candidate.url === 'string') return { imageUrl: candidate.url };
    if (typeof candidate.imageData === 'string') return { imageData: candidate.imageData };
    if (typeof candidate.image_base64 === 'string') return { imageData: candidate.image_base64 };

    const content = candidate.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item) continue;
        if (item.type === 'image' && typeof item.data === 'string') {
          return { imageData: item.data, mimeType: item.mimeType || 'image/png' };
        }
        if (item.type === 'resource' && typeof item.url === 'string') {
          return { imageUrl: item.url };
        }
        if (item.type === 'text' && typeof item.text === 'string') {
          const textUrl = extractUrlFromText(item.text);
          if (textUrl) return { imageUrl: textUrl };
        }
      }
    }

    if (typeof content === 'string') {
      const textUrl = extractUrlFromText(content);
      if (textUrl) return { imageUrl: textUrl };
    }
  }

  return null;
}

async function savePortraitToPublic(payload: { imageUrl?: string; imageData?: string; mimeType?: string }): Promise<string> {
  fs.mkdirSync(PORTRAIT_OUTPUT_DIR, { recursive: true });
  const stamp = Date.now();
  const rand = Math.random().toString(16).slice(2);
  const filename = `portrait-${stamp}-${rand}.png`;
  const outputPath = path.join(PORTRAIT_OUTPUT_DIR, filename);

  if (payload.imageData) {
    const dataUrlMatch = payload.imageData.match(/^data:(.+);base64,(.+)$/);
    const base64 = dataUrlMatch ? dataUrlMatch[2] : payload.imageData;
    fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
    return `assets/images/portraits/generated/${filename}`;
  }

  if (payload.imageUrl) {
    const response = await fetch(payload.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download portrait (${response.status}).`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return `assets/images/portraits/generated/${filename}`;
  }

  throw new Error('No image payload to save.');
}

async function generatePortraitWithStitch(prompt: string): Promise<string> {
  if (!fs.existsSync(MCP_CONFIG)) {
    throw new Error('Missing .mcp.json; Stitch MCP server is not configured.');
  }

  const tool = await resolveStitchImageTool();
  if (!tool) {
    throw new Error('No Stitch image tool found. Set STITCH_IMAGE_TOOL or run npm run mcp inspect stitch.');
  }

  const extraArgs = parseJsonInput(STITCH_EXTRA_ARGS);
  const args = { prompt, ...extraArgs };

  const { stdout, stderr } = await callMcpTool('stitch', tool, args);
  if (stderr && !stderr.toLowerCase().includes('debug')) {
    console.warn(`[portraits] stitch/${tool} stderr: ${stderr.trim()}`);
  }

  const parsed = extractJsonFromOutput(stdout);
  const payload = extractImagePayload(parsed);
  if (!payload) {
    throw new Error('Stitch returned no image payload. Set STITCH_IMAGE_TOOL/STITCH_IMAGE_ARGS to match the tool schema.');
  }

  return savePortraitToPublic(payload);
}

async function generatePortraitWithImageGen(prompt: string): Promise<string> {
  // Use the browser automation implementation directly (single process) so generate+download share state.
  // Calling the image-gen MCP via mcp-cli is stateless per invocation, which breaks the download step.
  let generateImage: any;
  let downloadImage: any;
  try {
    const mod = await import('./scripts/workflows/gemini/core/image-gen-mcp.ts');
    generateImage = mod.generateImage;
    downloadImage = mod.downloadImage;
  } catch (err) {
    if (process.env.GITHUB_ACTIONS || process.env.CI) {
      throw new Error('AI Portrait generation is a local-only feature and is not available in the GitHub environment. Please run the game locally to use this functionality.');
    }
    throw new Error('Local image generation script is unavailable. Please ensure you have the required scripts to use this feature locally.');
  }

  fs.mkdirSync(PORTRAIT_OUTPUT_DIR, { recursive: true });
  const stamp = Date.now();
  const rand = Math.random().toString(16).slice(2);
  const filename = `portrait-${stamp}-${rand}.png`;
  const outputPath = path.join(PORTRAIT_OUTPUT_DIR, filename);

  // Prefer attaching to a dedicated debug Chrome session (shared profile, less flaky consent/login).
  // Start it with: npm run mcp:chrome
  process.env.IMAGE_GEN_USE_CDP = process.env.IMAGE_GEN_USE_CDP || '1';
  process.env.IMAGE_GEN_CDP_URL = process.env.IMAGE_GEN_CDP_URL || 'http://localhost:9222';

  // If CDP is disabled, fall back to Playwright persistent profile. In that mode, we usually
  // don't want a visible browser window from the dev server.
  process.env.IMAGE_GEN_HEADLESS = process.env.IMAGE_GEN_HEADLESS || '1';

  const gen = await generateImage(prompt, 'gemini');
  if (!gen?.success) {
    throw new Error(typeof gen?.message === 'string' && gen.message ? gen.message : 'image-gen failed to generate an image.');
  }

  const dl = await downloadImage({ outputPath, prompt });
  if (!dl?.success || !fs.existsSync(outputPath)) {
    const msg = typeof dl?.message === 'string' && dl.message ? dl.message : 'image-gen failed to download the image.';
    throw new Error(`${msg}\nExpected: ${outputPath}`);
  }

  return `assets/images/portraits/generated/${filename}`;
}

const addProxyDiagnostics = (
  route: string,
  options: ProxyOptions,
  hint: string
): ProxyOptions => ({
  ...options,
  configure: (proxy, proxyOptions) => {
    if (options.configure) {
      options.configure(proxy, proxyOptions);
    }

    proxy.on('error', (error: any, req: any) => {
      const target = formatProxyTarget(options.target);
      const pathSuffix = req?.url ?? '';
      const requestPath = `${route}${pathSuffix}`;
      const errorCode = error?.code ? ` (${error.code})` : '';
      const errorMessage = error?.message ? ` ${error.message}` : '';
      const nestedErrors = Array.isArray(error?.errors) ? error.errors : [];
      const hasRefused =
        error?.code === 'ECONNREFUSED' ||
        nestedErrors.some((entry: any) => entry?.code === 'ECONNREFUSED');

      console.error(`[proxy] ${requestPath} -> ${target} failed${errorCode}.${errorMessage}`);
      if (error?.name === 'AggregateError') {
        console.error('[proxy] AggregateError: multiple connection attempts failed.');
      }
      if (hasRefused) {
        console.error(`[proxy] ECONNREFUSED: target refused the connection. ${hint}`);
      } else if (hint) {
        console.error(`[proxy] Hint: ${hint}`);
      }
    });
  }
});

const ROADMAP_DEV_PORT = 3010;
const ROADMAP_DEV_HOST = '127.0.0.1';
const ROADMAP_DEV_OPEN_PATH = '/Aralia/devtools/roadmap/roadmap.html';
const ROADMAP_DEV_HEALTH_URL = `http://${ROADMAP_DEV_HOST}:${ROADMAP_DEV_PORT}/api/roadmap/data`;
const ROADMAP_DEV_OPEN_URL = `http://${ROADMAP_DEV_HOST}:${ROADMAP_DEV_PORT}${ROADMAP_DEV_OPEN_PATH}`;

type RoadmapDevServerStatus = {
  running: boolean;
  openUrl: string;
  healthUrl: string;
};

// Technical: checks whether the isolated roadmap dev server is already alive on the fixed
// roadmap port and returns the URLs the user should open when it is.
// Layman: this tells us whether roadmap mode should reuse the existing server instead of
// starting another copy on the next free port.
const getRoadmapDevServerStatus = async (): Promise<RoadmapDevServerStatus> => {
  try {
    const response = await fetch(ROADMAP_DEV_HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    return {
      running: response.ok,
      openUrl: ROADMAP_DEV_OPEN_URL,
      healthUrl: ROADMAP_DEV_HEALTH_URL
    };
  } catch {
    return {
      running: false,
      openUrl: ROADMAP_DEV_OPEN_URL,
      healthUrl: ROADMAP_DEV_HEALTH_URL
    };
  }
};

const roadmapLauncherManager = () => ({
  name: 'roadmap-launcher-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url !== '/api/roadmap/start') {
        next();
        return;
      }

      if (req.method && req.method !== 'GET' && req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      try {
        const roadmapServer = await getRoadmapDevServerStatus();
        if (roadmapServer.running) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'already-running',
            port: ROADMAP_DEV_PORT,
            url: roadmapServer.openUrl,
            healthUrl: roadmapServer.healthUrl
          }));
          return;
        }

        console.info('[dev] Starting isolated roadmap server (npm run dev:roadmap)...');
        const child = spawn('npm', ['run', 'dev:roadmap'], {
          detached: true,
          stdio: 'ignore',
          shell: true,
          windowsHide: true,
          cwd: process.cwd(),
        });
        child.unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'starting', command: 'npm run dev:roadmap' }));
      } catch (error) {
        console.error('[dev] Failed to start roadmap server:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to start roadmap server' }));
      }
    });
  },
});


const visualizerManager = () => ({
  name: 'visualizer-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/visualizer/start') {
        console.info('[dev] Starting Codebase Visualizer server...');
        try {
          // Use npx tsx to run the script in the background
          const child = spawn('npx', ['tsx', 'misc/dev_hub/codebase-visualizer/server/index.ts'], {
            detached: true,
            stdio: 'ignore',
            shell: true,
            windowsHide: true,
          });
          child.unref();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'starting' }));
        } catch (error) {
          console.error('[dev] Failed to start visualizer:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to start visualizer server' }));
        }
        return;
      }
      next();
    });
  },
});

const roadmapManager = () => ({
  name: 'roadmap-manager',
  configureServer(server: any) {
    const workspaceDir = path.resolve(process.cwd(), '.agent', 'roadmap-local');
    const layoutPath = path.join(workspaceDir, 'layout.json');
    const labelOverridesPath = path.join(workspaceDir, 'node-label-overrides.json');
    const rootDir = path.resolve(process.cwd());
    const rootLower = rootDir.toLowerCase();

    const layoutResponse = (positions: Record<string, { x: number; y: number }> = {}) => ({ positions });
    const isRoadmapPath = (pathname: string, suffix: string) => pathname === suffix || pathname === `/Aralia${suffix}`;
    const opportunitiesResponseHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    const readLayout = () => {
      if (!fs.existsSync(layoutPath)) return layoutResponse();
      try {
        const parsed = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) as { positions?: unknown };
        const positions: Record<string, { x: number; y: number }> = {};
        const input = parsed.positions;
        if (input && typeof input === 'object') {
          for (const [id, point] of Object.entries(input as Record<string, unknown>)) {
            if (!point || typeof point !== 'object') continue;
            const x = Number((point as { x?: unknown }).x);
            const y = Number((point as { y?: unknown }).y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            positions[id] = { x, y };
          }
        }
        return layoutResponse(positions);
      } catch {
        return layoutResponse();
      }
    };

    const labelOverridesResponse = (overrides: Record<string, string> = {}) => ({ overrides });

    // Technical: loads saved node display-name overrides keyed by stable node id.
    // Layman: remembers custom node names without changing identity/test/layout keys.
    const readNodeLabelOverrides = () => {
      if (!fs.existsSync(labelOverridesPath)) return labelOverridesResponse();
      try {
        const parsed = JSON.parse(fs.readFileSync(labelOverridesPath, 'utf-8')) as { overrides?: unknown };
        const overrides: Record<string, string> = {};
        const input = parsed.overrides;
        if (input && typeof input === 'object') {
          for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
            if (typeof value !== 'string') continue;
            if (!/^[a-zA-Z0-9:_-]+$/.test(id)) continue;
            const normalized = value.trim();
            if (!normalized) continue;
            overrides[id] = normalized;
          }
        }
        return labelOverridesResponse(overrides);
      } catch {
        return labelOverridesResponse();
      }
    };

    // Technical: persists node display-name overrides to roadmap-local storage.
    // Layman: saves renamed node titles so they stay after refresh/restart.
    const writeNodeLabelOverrides = (overrides: Record<string, string>) => {
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(labelOverridesPath, JSON.stringify(labelOverridesResponse(overrides), null, 2), 'utf-8');
    };
    const normalizeDocPath = (rawPath: string) => {
      const trimmed = String(rawPath || '').trim().replace(/\\/g, '/');
      if (!trimmed) return null;
      const withoutPrefix = trimmed.replace(/^\/?Aralia\//i, '').replace(/^\/+/, '');
      if (!withoutPrefix.toLowerCase().endsWith('.md')) return null;
      const resolved = path.resolve(rootDir, withoutPrefix);
      if (!resolved.toLowerCase().startsWith(rootLower)) return null;
      return resolved;
    };

    // Technical: strict node id validation to avoid shell-injection when tests are executed.
    // Layman: only plain roadmap node ids are allowed in test-run API requests.
    const isSafeRoadmapNodeId = (value: string) => /^[a-zA-Z0-9:_-]+$/.test(value);

    // Technical: runs one roadmap node test command and captures pass/fail plus short output.
    // Layman: executes the same node test you can run in terminal and returns a compact result.
    const runRoadmapNodeTest = (nodeId: string) => {
      const command = `npx tsx devtools/roadmap/scripts/roadmap-node-test.ts --node-id ${nodeId}`;
      try {
        const stdout = execSync(command, {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 240000,
          windowsHide: true,
        }).trim();
        return { nodeId, ok: true, message: stdout || 'PASS' };
      } catch (error: any) {
        const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
        const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
        const message = stderr || stdout || String(error?.message || 'Unknown failure');
        return { nodeId, ok: false, message: message.split('\n')[0] || 'Node test failed.' };
      }
    };

    server.middlewares.use(async (req: any, res: any, next: any) => {
      // WHAT CHANGED: Switched to dynamic import for roadmap server logic.
      // WHY IT CHANGED: Importing roadmap logic statically at the top 
      // of vite.config.ts caused any edit to the logic file to trigger 
      // a full Vite server restart. Dynamic import allows us to hot-swap 
      // the backend logic for dev tools without interrupting the 
      // primary application dev server.
      const {
        generateRoadmapData,
        loadLatestOpportunityScan,
        loadRoadmapHistoryTraceability,
        readOpportunitySettings,
        scanRoadmapOpportunities,
        writeOpportunitySettings,
      } = await import('./devtools/roadmap/scripts/roadmap-server-logic.ts');

      const pathname = new URL(req.url || '/', 'http://localhost').pathname;

      // Handle both with and without base path for dev flexibility
      if (isRoadmapPath(pathname, '/api/roadmap/data')) {
        try {
          const data = generateRoadmapData();
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(data));
        } catch (error) {
          console.error('[dev] Failed to generate roadmap data:', error);
          const message = error instanceof Error ? error.message : String(error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to generate roadmap data', message }));
        }
        return;
      }

      if (isRoadmapPath(pathname, '/api/roadmap/layout') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(readLayout()));
        return;
      }

      if (isRoadmapPath(pathname, '/api/roadmap/labels') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(readNodeLabelOverrides()));
        return;
      }

      if (isRoadmapPath(pathname, '/api/roadmap/layout') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as { positions?: unknown };
            const sanitized: Record<string, { x: number; y: number }> = {};
            const incoming = parsed.positions;
            if (incoming && typeof incoming === 'object') {
              for (const [id, point] of Object.entries(incoming as Record<string, unknown>)) {
                if (!point || typeof point !== 'object') continue;
                const x = Number((point as { x?: unknown }).x);
                const y = Number((point as { y?: unknown }).y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                sanitized[id] = { x, y };
              }
            }
            fs.mkdirSync(workspaceDir, { recursive: true });
            fs.writeFileSync(layoutPath, JSON.stringify(layoutResponse(sanitized), null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, positions: Object.keys(sanitized).length }));
          })
          .catch((saveError) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to save roadmap layout: ${String(saveError)}` }));
          });
        return;
      }

      if (isRoadmapPath(pathname, '/api/roadmap/labels/rename') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as { nodeId?: unknown; label?: unknown };
            const nodeId = typeof parsed.nodeId === 'string' ? parsed.nodeId.trim() : '';
            const rawLabel = typeof parsed.label === 'string' ? parsed.label : '';
            const normalizedLabel = rawLabel.replace(/\s+/g, ' ').trim();

            if (!nodeId || !isSafeRoadmapNodeId(nodeId)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid node id format.' }));
              return;
            }
            if (!normalizedLabel) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Label cannot be empty.' }));
              return;
            }
            if (normalizedLabel.length > 180) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Label is too long (max 180 characters).' }));
              return;
            }

            const { overrides } = readNodeLabelOverrides();
            overrides[nodeId] = normalizedLabel;
            writeNodeLabelOverrides(overrides);

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, nodeId, label: normalizedLabel, overrides }));
          })
          .catch((renameError) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to rename roadmap node: ${String(renameError)}` }));
          });
        return;
      }
      if (isRoadmapPath(pathname, '/api/roadmap/open-in-vscode') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as { path?: string };
            const fullPath = normalizeDocPath(parsed.path || '');
            if (!fullPath) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid file path. Only in-repo .md files are allowed.' }));
              return;
            }
            if (!fs.existsSync(fullPath)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Target file not found.' }));
              return;
            }
            const child = spawn('code', ['-r', fullPath], { detached: true, stdio: 'ignore', shell: true, windowsHide: true });
            child.unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, path: fullPath }));
          })
          .catch((openError) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to open VS Code: ${String(openError)}` }));
          });
        return;
      }

      if (isRoadmapPath(pathname, '/api/roadmap/tests/run-nodes') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as { nodeIds?: unknown };
            const nodeIds = Array.isArray(parsed.nodeIds)
              ? parsed.nodeIds
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
              : [];

            if (nodeIds.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'nodeIds[] is required.' }));
              return;
            }

            const uniqueNodeIds = Array.from(new Set(nodeIds));
            if (uniqueNodeIds.some((id) => !isSafeRoadmapNodeId(id))) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid node id format.' }));
              return;
            }

            const roadmap = generateRoadmapData();
            const byId = new Map(roadmap.nodes.map((node) => [node.id, node]));

            const results = uniqueNodeIds.map((nodeId) => {
              const node = byId.get(nodeId);
              if (!node) return { nodeId, ok: false, message: 'Node not found.' };
              if (node.status !== 'done' || !node.testCommand) {
                return { nodeId, ok: false, message: 'Node is not testable (only done nodes have tests).' };
              }
              return runRoadmapNodeTest(nodeId);
            });

            const pass = results.filter((row) => row.ok).length;
            const fail = results.length - pass;

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ total: results.length, pass, fail, results }));
          })
          .catch((runError) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to run roadmap tests: ${String(runError)}` }));
          });
        return;
      }

      // Technical: roadmap history endpoint for selected doc/component file traces.
      // Layman: the visualizer calls this to show recent git history for the files a node points at.
      if (isRoadmapPath(pathname, '/api/roadmap/history') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as {
              selectedNodeId?: unknown;
              selectedNodeLabel?: unknown;
              selectedPaths?: unknown;
              componentFiles?: unknown;
              docPaths?: unknown;
              limit?: unknown;
            };
            const toStringArray = (value: unknown) =>
              Array.isArray(value)
                ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
                : [];

            const payload = loadRoadmapHistoryTraceability({
              selectedNodeId: typeof parsed.selectedNodeId === 'string' ? parsed.selectedNodeId : null,
              selectedNodeLabel: typeof parsed.selectedNodeLabel === 'string' ? parsed.selectedNodeLabel : null,
              selectedPaths: toStringArray(parsed.selectedPaths),
              componentFiles: toStringArray(parsed.componentFiles),
              docPaths: toStringArray(parsed.docPaths),
              limit: typeof parsed.limit === 'number' ? parsed.limit : undefined
            });

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(payload));
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to load roadmap history: ${message}` }));
          });
        return;
      }

      // Technical: roadmap opportunities latest payload endpoint.
      // Layman: the UI calls this to read the current collector state quickly.
      if (isRoadmapPath(pathname, '/api/roadmap/opportunities') && req.method === 'GET') {
        try {
          const latest = loadLatestOpportunityScan();
          if (latest) {
            res.writeHead(200, opportunitiesResponseHeaders);
            res.end(JSON.stringify(latest));
            return;
          }

          const roadmap = generateRoadmapData();
          const payload = scanRoadmapOpportunities(roadmap, { trigger: 'on-demand' });
          res.writeHead(200, opportunitiesResponseHeaders);
          res.end(JSON.stringify(payload));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to read roadmap opportunities: ${message}` }));
        }
        return;
      }

      // Technical: manual/auto scan trigger endpoint.
      // Layman: this runs a fresh opportunities scan and returns updated results.
      if (isRoadmapPath(pathname, '/api/roadmap/opportunities/scan') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as { trigger?: unknown };
            const trigger = parsed.trigger === 'manual' || parsed.trigger === 'auto' ? parsed.trigger : 'manual';
            const roadmap = generateRoadmapData();
            const payload = scanRoadmapOpportunities(roadmap, { trigger });
            res.writeHead(200, opportunitiesResponseHeaders);
            res.end(JSON.stringify(payload));
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to scan roadmap opportunities: ${message}` }));
          });
        return;
      }

      // Technical: read scanner settings endpoint.
      // Layman: returns local opportunities settings such as scan interval and stale threshold.
      if (isRoadmapPath(pathname, '/api/roadmap/opportunities/settings') && req.method === 'GET') {
        try {
          const settings = readOpportunitySettings();
          res.writeHead(200, opportunitiesResponseHeaders);
          res.end(JSON.stringify(settings));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to read opportunity settings: ${message}` }));
        }
        return;
      }

      // Technical: update scanner settings endpoint.
      // Layman: saves local opportunities settings and returns the normalized values.
      if (isRoadmapPath(pathname, '/api/roadmap/opportunities/settings') && req.method === 'POST') {
        readBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}');
            const settings = writeOpportunitySettings(parsed);
            res.writeHead(200, opportunitiesResponseHeaders);
            res.end(JSON.stringify(settings));
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to write opportunity settings: ${message}` }));
          });
        return;
      }

      // Technical: serves the pre-generated spell canonical profile dataset.
      // Layman: the Spell Branch Navigator reads all 469 spell profiles from this endpoint.
      if (isRoadmapPath(pathname, '/api/roadmap/spell-profiles') && req.method === 'GET') {
        const spellProfilesPath = path.resolve(process.cwd(), '.agent', 'roadmap', 'spell-profiles.json');
        try {
          const data = fs.readFileSync(spellProfilesPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(data);
        } catch (err) {
          const isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT';
          res.writeHead(isNotFound ? 404 : 500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: isNotFound
                ? 'spell-profiles.json not found — run: npx tsx devtools/roadmap/scripts/generate-spell-profiles.ts'
                : 'Failed to read spell-profiles.json',
            })
          );
        }
        return;
      }

      // Technical: serves a captured media file (PNG/GIF) for a roadmap node by id.
      // Layman: the "View Preview" button in the info panel fetches from here.
      const mediaMatch = pathname.match(/^\/api\/roadmap\/media\/([^/?]+)$/);
      if (mediaMatch && req.method === 'GET') {
        const nodeId = decodeURIComponent(mediaMatch[1]);
        const mediaDir = path.resolve(process.cwd(), 'devtools', 'roadmap', '.media');
        const extensions = ['.gif', '.png', '.webp', '.jpg', '.jpeg'];
        let found: string | null = null;
        for (const ext of extensions) {
          const candidate = path.join(mediaDir, `${nodeId}${ext}`);
          if (fs.existsSync(candidate)) { found = candidate; break; }
        }
        if (!found) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No media found for node', nodeId }));
          return;
        }
        const ext = path.extname(found).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          '.gif': 'image/gif',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg'
        };
        res.writeHead(200, {
          'Content-Type': contentTypeMap[ext] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(found).pipe(res);
        return;
      }

      next();
    });

    // Technical: when local roadmap engine files change, clear the in-process data
    // cache so the next request re-runs the bridge with the updated files.
    // Layman: editing a roadmap node definition immediately reflects after the next
    // page reload, instead of requiring a full server restart.
    const engineDir = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-engine');
    const bridgePath = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-local-bridge.ts');
    server.watcher.add([engineDir, bridgePath]);
    server.watcher.on('change', async (file: string) => {
      const normalized = file.replace(/\\/g, '/');
      if (normalized.includes('roadmap-engine') || normalized.includes('roadmap-local-bridge')) {
        const { clearRoadmapDataCache } = await import('./devtools/roadmap/scripts/roadmap-server-logic.ts');
        clearRoadmapDataCache();
        console.info('[roadmap] Data cache cleared due to file change:', path.basename(file));
      }
    });
  }
});

const conductorManager = () => ({
  name: 'conductor-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      // 1. List Tracks
      if (req.url === '/api/conductor/list') {
        try {
          const tracksPath = path.resolve(process.cwd(), 'conductor/tracks.md');
          if (!fs.existsSync(tracksPath)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'tracks.md not found' }));
            return;
          }
          const content = fs.readFileSync(tracksPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // 2. Read File
      if (req.url.startsWith('/api/conductor/read')) {
        try {
          const url = new URL(req.url, 'http://localhost');
          const relativePath = url.searchParams.get('path');

          if (!relativePath) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing path param' }));
            return;
          }

          // Security: Prevent directory traversal up
          const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
          const fullPath = path.resolve(process.cwd(), 'conductor', safePath);

          if (!fs.existsSync(fullPath)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
          }

          const content = fs.readFileSync(fullPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }
      next();
    });
  }
});

const scanManager = () => ({
  name: 'scan-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/scan') {
        exec('npx tsx scripts/scan-quality.ts --json', { cwd: process.cwd(), timeout: 30000, windowsHide: true }, (error: any, stdout: string, stderr: string) => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          if (error) {
            res.end(JSON.stringify({ error: 'Scan failed', message: stderr || error.message }));
          } else {
            res.end(stdout.trim());
          }
        });
        return;
      }
      next();
    });
  }
});

const gitStatusManager = () => ({
  name: 'git-status-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/git/status') {
        try {
          const branch = execSync('git branch --show-current', { encoding: 'utf-8', windowsHide: true }).trim();
          const porcelain = execSync('git status --porcelain', { encoding: 'utf-8', windowsHide: true });
          const dirty = porcelain.split('\n').filter(Boolean).length;
          const lastCommit = execSync('git log -1 --format=%s', { encoding: 'utf-8', windowsHide: true }).trim();
          const lastCommitDate = execSync('git log -1 --format=%cr', { encoding: 'utf-8', windowsHide: true }).trim();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ branch, dirty, lastCommit, lastCommitDate }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }
      next();
    });
  }
});

const devHubApiManager = () => ({
  name: 'devhub-api-manager',
  configureServer(server: any) {
    let spellFieldInventoryCache: SpellFieldInventory | null = null;
    let spellFieldInventoryLoadedAt = 0;

    // ============================================================================
    // Spell field inventory cache helper
    // ============================================================================
    // Technical:
    // The spell inventory scan is fast enough for on-demand use, but still expensive
    // enough that repeated keystroke-level queries should not rebuild it every time.
    // We keep a short-lived in-memory cache and allow the client to force-refresh it.
    //
    // Layman:
    // The Dev Hub can search all spell JSON files without rescanning the whole spell
    // dataset on every single click. The Refresh button still forces a clean rebuild.
    // ============================================================================
    const getSpellFieldInventory = (forceRefresh = false): SpellFieldInventory => {
      const now = Date.now();
      const cacheIsFresh = spellFieldInventoryCache && (now - spellFieldInventoryLoadedAt) < 15_000;
      if (!forceRefresh && cacheIsFresh) {
        return spellFieldInventoryCache;
      }

      spellFieldInventoryCache = buildSpellFieldInventory();
      spellFieldInventoryLoadedAt = now;
      return spellFieldInventoryCache;
    };

    server.middlewares.use((req: any, res: any, next: any) => {
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      const urlPath = parsedUrl.pathname;

      // ============================================================================
      // Spell field inventory API
      // ============================================================================
      // Technical:
      // These endpoints expose the normalized spell field/value inventory to the Dev Hub.
      // One route returns a compact summary for browsing field paths, and another returns
      // filtered matches for reverse lookups like "show every spell that contains 1d4".
      //
      // Layman:
      // This is the browser-friendly search layer for the spell crawler. It lets the Dev
      // Hub show all known fields and search across spell values without dumping one giant
      // static report into a markdown file.
      // ============================================================================
      if (urlPath === '/api/spells/field-inventory/summary') {
        try {
          const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
          const inventory = getSpellFieldInventory(forceRefresh);
          const summary = createSpellFieldInventorySummary(inventory);
          json(summary);
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/spells/field-inventory/query') {
        try {
          const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
          const inventory = getSpellFieldInventory(forceRefresh);
          const levelParam = parsedUrl.searchParams.get('level');
          const level = levelParam !== null && levelParam !== '' ? Number(levelParam) : undefined;
          const query = querySpellFieldInventory(inventory, {
            fieldPath: parsedUrl.searchParams.get('fieldPath') ?? '',
            value: parsedUrl.searchParams.get('value') ?? '',
            level: Number.isFinite(level as number) ? level : undefined,
            includeFreeText: parsedUrl.searchParams.get('includeFreeText') === '1',
            limit: Number(parsedUrl.searchParams.get('limit') ?? 200),
          });
          json(query);
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      // Test runner - runs vitest and reads the JSON results file
      if (req.url === '/api/test') {
        exec('npx vitest run', { cwd: process.cwd(), timeout: 120000, windowsHide: true }, (_error: any) => {
          try {
            const resultsPath = path.resolve(process.cwd(), 'vitest-results.json');
            if (fs.existsSync(resultsPath)) {
              const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
              json(results);
            } else {
              json({ error: 'No vitest-results.json produced' });
            }
          } catch (e) {
            json({ error: 'Parse failed', message: String(e) });
          }
        });
        return;
      }

      // CI status - queries GitHub Actions via gh CLI
      if (req.url === '/api/ci/status') {
        exec(
          'gh run list --limit 5 --json status,conclusion,name,createdAt,headBranch,databaseId',
          { cwd: process.cwd(), timeout: 10000, windowsHide: true },
          (_error: any, stdout: string) => {
            if (_error) { json({ error: 'gh CLI unavailable' }); return; }
            try { json({ runs: JSON.parse(stdout.trim()) }); }
            catch { json({ error: 'Parse failed' }); }
          }
        );
        return;
      }

      // Environment health - server-side checks
      if (req.url === '/api/health/env') {
        json({ rDrive: fs.existsSync('R:\\AraliaV4\\Aralia') });
        return;
      }

      // Agent config discovery - lists rules, skills, workflows
      if (req.url === '/api/agent/config') {
        try {
          const agentDir = path.resolve(process.cwd(), '.agent');
          const readMdFiles = (sub: string) => {
            const dir = path.join(agentDir, sub);
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
              .filter((d: any) => d.isFile() && d.name.endsWith('.md'))
              .map((d: any) => {
                const item: any = { name: d.name.replace('.md', ''), path: `.agent/${sub}/${d.name}` };
                // Parse frontmatter for chain metadata
                try {
                  const content = fs.readFileSync(path.join(dir, d.name), 'utf-8');
                  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                  if (fm) {
                    const block = fm[1].replace(/\r/g, '');
                    const chainMatch = block.match(/^chain:\s*(.+)$/m);
                    const viaMatch = block.match(/^chain_via:\s*(.+)$/m);
                    const orderMatch = block.match(/^chain_order:\s*(\d+)$/m);
                    if (chainMatch) item.chain = chainMatch[1].trim();
                    if (viaMatch) item.chainVia = viaMatch[1].trim();
                    if (orderMatch) item.chainOrder = parseInt(orderMatch[1], 10);
                  }
                } catch (_) { /* ignore read errors */ }
                return item;
              });
          };
          // Load tidy-up chain config for tagging skills and injecting extras
          const chainConfigPath = path.join(agentDir, 'tidy-up-chain.json');
          const chainConfig = fs.existsSync(chainConfigPath)
            ? JSON.parse(fs.readFileSync(chainConfigPath, 'utf-8'))
            : { extras: [], skills: [] };
          const skillsInTidyUp: string[] = chainConfig.skills || [];
          const skillsDir = path.join(agentDir, 'skills');
          const skills = fs.existsSync(skillsDir)
            ? fs.readdirSync(skillsDir, { withFileTypes: true })
              .filter((d: any) => d.isDirectory())
              .map((d: any) => {
                const item: any = { name: d.name, path: `.agent/skills/${d.name}/SKILL.md` };
                if (skillsInTidyUp.includes(d.name)) { item.chain = 'tidy-up'; item.chainVia = 'session-ritual'; }
                return item;
              })
            : [];
          // Conductor commands — the track management slash commands from .claude/commands
          const claudeCmdsDir = path.resolve(process.cwd(), '.claude/commands');
          const conductorCommands = fs.existsSync(claudeCmdsDir)
            ? fs.readdirSync(claudeCmdsDir, { withFileTypes: true })
              .filter((d: any) => d.isFile() && d.name.startsWith('conductor-') && d.name.endsWith('.md'))
              .map((d: any) => ({ name: d.name.replace('.md', ''), path: `.claude/commands/${d.name}`, source: 'claude' }))
            : [];
          // Track workflows — the conductor workflow mirrors from .agent/workflows
          const allWorkflows = readMdFiles('workflows');
          const trackWorkflows = allWorkflows
            .filter((w: any) => w.name.startsWith('track-'))
            .map((w: any) => ({ ...w, source: 'agent' }));
          const workflows = allWorkflows.filter((w: any) => !w.name.startsWith('track-'));
          const conductor = [...conductorCommands, ...trackWorkflows];
          // Extra chain items from tidy-up-chain.json (scripts/commands without their own workflow files)
          const chainExtras = (chainConfig.extras || []).map((e: any) => ({
            ...e,
            chain: 'tidy-up',
          }));
          json({ rules: readMdFiles('rules'), skills, workflows: [...workflows, ...chainExtras], conductor });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      next();
    });
  }
});

// ============================================================================
// Script Registry API
// ============================================================================
// Technical: serves script-registry.json + .run-log.json data, and handles
// "touch" requests that reset lastRun timestamps for an entire feature branch.
// Layman: powers the Branch View tab in misc/tooling.html so agents/devs can
// see which tooling scripts belong to which feature area and when they last ran.
// ============================================================================
const SCRIPT_REGISTRY_PATH = path.resolve(process.cwd(), 'scripts', 'tooling', 'script-registry.json');
const SCRIPT_RUN_LOG_PATH = path.resolve(process.cwd(), 'scripts', 'tooling', '.run-log.json');

const scriptRegistryManager = () => ({
  name: 'script-registry-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== '/api/script-registry' && urlPath !== '/api/script-touch') {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      // GET /api/script-registry — merged registry + run-log data
      if (urlPath === '/api/script-registry' && req.method === 'GET') {
        try {
          if (!fs.existsSync(SCRIPT_REGISTRY_PATH)) {
            json({ error: 'script-registry.json not found.' }, 404);
            return;
          }
          const registry = JSON.parse(fs.readFileSync(SCRIPT_REGISTRY_PATH, 'utf8'));
          const runLog = fs.existsSync(SCRIPT_RUN_LOG_PATH)
            ? JSON.parse(fs.readFileSync(SCRIPT_RUN_LOG_PATH, 'utf8'))
            : { entries: {} };

          // Merge run-log data into each script entry.
          // registry.scripts entries are now objects: { path, type?, note? }
          const now = Date.now();
          const branches: Record<string, any> = {};
          for (const [branchId, branch] of Object.entries(registry.featureBranches as Record<string, any>)) {
            const scriptEntries = (branch.scripts as Array<string | { path: string; type?: string; note?: string }>);
            branches[branchId] = {
              ...branch,
              id: branchId,
              scripts: scriptEntries.map((scriptDef) => {
                const relPath = typeof scriptDef === 'string' ? scriptDef : scriptDef.path;
                const scriptType = typeof scriptDef === 'object' ? (scriptDef.type ?? branch.bucket) : branch.bucket;
                const scriptNote = typeof scriptDef === 'object' ? (scriptDef.note ?? null) : null;
                const entry = runLog.entries?.[relPath];
                const lastRunMs = entry?.lastRun ? new Date(entry.lastRun).getTime() : null;
                const ageDays = lastRunMs ? Math.floor((now - lastRunMs) / 86400000) : null;
                return {
                  path: relPath,
                  name: path.basename(relPath, path.extname(relPath)),
                  type: scriptType,   // 'pipeline' | 'devworkflow'
                  note: scriptNote,
                  lastRun: entry?.lastRun ?? null,
                  runCount: entry?.runCount ?? 0,
                  ageDays,
                  ageClass: ageDays === null ? 'never' : ageDays < 30 ? 'fresh' : ageDays < 90 ? 'aging' : 'stale',
                };
              }),
            };
          }

          json({ branches, buckets: registry.buckets ?? {}, logUpdated: runLog.updated ?? null });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      // POST /api/script-touch { branch: "branch-id" } — reset lastRun for all scripts in branch
      if (urlPath === '/api/script-touch' && req.method === 'POST') {
        try {
          const body = await readBody(req);
          const { branch: branchId } = JSON.parse(body);
          if (!branchId || typeof branchId !== 'string') {
            json({ error: 'Missing or invalid branch field.' }, 400);
            return;
          }

          if (!fs.existsSync(SCRIPT_REGISTRY_PATH)) {
            json({ error: 'script-registry.json not found.' }, 404);
            return;
          }
          const registry = JSON.parse(fs.readFileSync(SCRIPT_REGISTRY_PATH, 'utf8'));
          const branch = registry.featureBranches?.[branchId];
          if (!branch) {
            json({ error: `Branch '${branchId}' not found.` }, 404);
            return;
          }

          const runLog: any = fs.existsSync(SCRIPT_RUN_LOG_PATH)
            ? JSON.parse(fs.readFileSync(SCRIPT_RUN_LOG_PATH, 'utf8'))
            : { updated: new Date().toISOString(), entries: {} };

          const now = new Date().toISOString();
          for (const scriptDef of branch.scripts as Array<string | { path: string }>) {
            const relPath = typeof scriptDef === 'string' ? scriptDef : scriptDef.path;
            const existing = runLog.entries?.[relPath] ?? { scriptPath: relPath, runCount: 0 };
            runLog.entries[relPath] = { ...existing, lastRun: now };
          }
          runLog.updated = now;
          fs.writeFileSync(SCRIPT_RUN_LOG_PATH, JSON.stringify(runLog, null, 2), 'utf8');

          json({ ok: true, branch: branchId, touchedAt: now, count: (branch.scripts as string[]).length });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      next();
    });
  },
});

// ============================================================================
// Glossary Index Dev Refresh API
// ============================================================================
// Technical: adds a dev-server-only endpoint that runs generateGlossaryIndex.js on demand.
// Layman: when the user opens the glossary in dev mode, the app can ask the local server to
// rebuild the glossary catalog so newly added entries show up without a separate terminal step.
// ============================================================================
const glossaryIndexManager = () => ({
  name: 'glossary-index-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      const isGlossaryIndexPath = urlPath === '/api/glossary/rebuild-index' || urlPath === '/Aralia/api/glossary/rebuild-index';
      if (!isGlossaryIndexPath) {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (req.method !== 'POST') {
        json({ error: 'Method not allowed.' }, 405);
        return;
      }

      try {
        const scriptPath = path.resolve(process.cwd(), 'scripts', 'generateGlossaryIndex.js');
        const command = `node "${scriptPath}"`;
        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          shell: true,
          timeout: 60000,
          windowsHide: true,
        });

        json({
          ok: true,
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      } catch (error) {
        console.error('[dev] Failed to rebuild glossary index:', error);
        const message = error instanceof Error ? error.message : String(error);
        json({ ok: false, error: 'Failed to rebuild glossary index', message }, 500);
      }
    });
  },
});

// ============================================================================
// Glossary Spell Gate Dev Refresh API
// ============================================================================
// The spell gate checker already has good per-spell rendering logic in the browser,
// but its richer canonical buckets come from generated reports. This endpoint gives
// the glossary a dev-only way to ask for one fresh spell answer at a time instead of
// rebuilding the whole corpus every time the user clicks a spell.
// ============================================================================
const glossarySpellGateManager = () => ({
  name: 'glossary-spell-gate-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      const isSpellGatePath = urlPath === '/api/glossary/recheck-spell-gate' || urlPath === '/Aralia/api/glossary/recheck-spell-gate';
      if (!isSpellGatePath) {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (req.method !== 'POST') {
        json({ error: 'Method not allowed.' }, 405);
        return;
      }

      try {
        const body = JSON.parse(await readBody(req));
        const spellId = typeof body?.spellId === 'string' ? body.spellId.trim() : '';

        if (!spellId) {
          json({ error: 'Missing spellId.' }, 400);
          return;
        }

        // We deliberately execute the existing spell-truth scripts in one-spell
        // mode instead of reimplementing their logic in the dev server. That keeps
        // the glossary aligned with the same criteria the broader audits already use.
        const gateCommand = `npx tsx scripts/generateSpellGateReport.ts --spell-id=${spellId} --json`;
        const structuredCommand = `npx tsx scripts/auditSpellStructuredAgainstCanonical.ts --spell-id=${spellId} --json`;
        const structuredJsonCommand = `npx tsx scripts/auditSpellStructuredAgainstJson.ts --spell-id=${spellId} --json`;
        const [{ stdout: gateStdout }, { stdout: structuredStdout }, { stdout: structuredJsonStdout }] = await Promise.all([
          execAsync(gateCommand, {
            cwd: process.cwd(),
            shell: true,
            timeout: 60000,
            windowsHide: true,
          }),
          execAsync(structuredCommand, {
            cwd: process.cwd(),
            shell: true,
            timeout: 60000,
            windowsHide: true,
          }),
          execAsync(structuredJsonCommand, {
            cwd: process.cwd(),
            shell: true,
            timeout: 60000,
            windowsHide: true,
          }),
        ]);
        const gateEntry = JSON.parse(gateStdout);
        const structuredReport = JSON.parse(structuredStdout);
        const structuredJsonReport = JSON.parse(structuredJsonStdout);

        json({
          ok: true,
          spellId,
          gateEntry,
          structuredMismatches: structuredReport.mismatches.filter((mismatch) => mismatch.spellId === spellId),
          structuredJsonMismatches: structuredJsonReport.mismatches.filter((mismatch) => mismatch.spellId === spellId),
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[dev] Failed to refresh one spell gate check:', error);
        const message = error instanceof Error ? error.message : String(error);
        json({ ok: false, error: 'Failed to refresh one spell gate check', message }, 500);
      }
    });
  },
});

const codexRunManager = () => ({
  name: 'codex-run-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];

      const jsonReply = (res: any, data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      // ── POST /api/npm-run  →  spawn codex, return jobId ──────────────
      if (urlPath === '/api/npm-run' && req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req));
          const script = String(body?.script || '');
          if (!isSafeScriptName(script)) {
            jsonReply(res, { error: 'Invalid script name.' }, 400);
            return;
          }

          const jobId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
          const cwd = process.cwd();

          // On Windows, npm installs executables as .cmd wrappers (codex.cmd).
          // shell: false can't resolve .cmd files — the shell is required to find them.
          // --dangerously-bypass-approvals-and-sandbox lets codex shell out to npm;
          // the default read-only sandbox blocks it. Safe here: script names are validated
          // by SAFE_SCRIPT_NAME_RE. --color never suppresses ANSI codes in the browser terminal.
          // Prompt is double-quoted so cmd.exe passes it as one argument to codex.
          const proc = spawn(
            'codex',
            ['exec', '--dangerously-bypass-approvals-and-sandbox', '--color', 'never', `"npm run ${script}"`],
            { cwd, shell: process.platform === 'win32', windowsHide: true }
          );

          const job: CodexJob = { proc, subscribers: [], done: false, exitCode: null, buffer: [] };
          codexJobs.set(jobId, job);

          const emit = (chunk: string) => {
            job.buffer.push(chunk);
            for (const fn of job.subscribers) fn(chunk);
          };

          proc.stdout?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          proc.stderr?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));

          // Critical: handle spawn errors (e.g. codex not installed / ENOENT)
          // Without this, an unhandled 'error' event would crash the Vite server process.
          // Subscribers are NOT cleared on exit — the SSE stream stays open for multi-turn continues.
          proc.on('error', (err: Error) => {
            emit(Buffer.from(`[spawn error: ${err.message}]\n`).toString('base64'));
            job.done = true;
            job.exitCode = -1;
            for (const fn of job.subscribers) fn('__EXIT__:-1');
            setTimeout(() => codexJobs.delete(jobId), 30 * 60 * 1000);
          });

          proc.on('close', (code: number | null) => {
            if (job.done) return; // already handled by 'error' event
            job.done = true;
            job.exitCode = code;
            for (const fn of job.subscribers) fn(`__EXIT__:${code ?? -1}`);
            setTimeout(() => codexJobs.delete(jobId), 30 * 60 * 1000);
          });

          jsonReply(res, { jobId });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      // ── GET /api/npm-run/:jobId/stream  →  SSE ────────────────────────
      const streamMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/stream$/);
      if (streamMatch && req.method === 'GET') {
        const jobId = streamMatch[1];
        const job = codexJobs.get(jobId);
        if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const send = (chunk: string) => { if (!res.writableEnded) res.write(`data: ${chunk}\n\n`); };

        // Replay buffered output so late-connecting clients catch up
        for (const chunk of job.buffer) send(chunk);

        // If already done, send the exit marker but keep stream open for future continues.
        if (job.done) send(`__EXIT__:${job.exitCode ?? -1}`);

        // Subscribe to live output — stream stays open indefinitely for multi-turn.
        // __EXIT__ is passed through as data (client shows input area); res is not ended here.
        const subscriber = (chunk: string) => send(chunk);
        job.subscribers.push(subscriber);

        // Heartbeat keeps the connection alive through proxies / idle timeouts
        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(': keepalive\n\n');
          else clearInterval(heartbeat);
        }, 25_000);

        // Clean up on client disconnect
        req.on('close', () => {
          clearInterval(heartbeat);
          job.subscribers = job.subscribers.filter((fn: any) => fn !== subscriber);
        });
        return;
      }

      // ── POST /api/npm-run/:jobId/kill  →  SIGTERM ─────────────────────
      const killMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/kill$/);
      if (killMatch && req.method === 'POST') {
        const jobId = killMatch[1];
        const job = codexJobs.get(jobId);
        if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }
        if (job.proc) try { job.proc.kill('SIGTERM'); } catch { /* already exited */ }
        jsonReply(res, { ok: true });
        return;
      }

      // ── POST /api/npm-run/:jobId/continue  →  multi-turn conversation ──
      const continueMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/continue$/);
      if (continueMatch && req.method === 'POST') {
        try {
          const jobId = continueMatch[1];
          const job = codexJobs.get(jobId);
          if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }

          const body = JSON.parse(await readBody(req));
          const message = String(body?.message || '').trim();
          if (!message) { jsonReply(res, { error: 'Empty message.' }, 400); return; }

          // Reuse the same emit → SSE subscribers channel
          const emit = (chunk: string) => {
            job.buffer.push(chunk);
            for (const fn of job.subscribers) fn(chunk);
          };

          // Reset done so new output flows through
          job.done = false;
          job.exitCode = null;

          // Resume the most recent codex session. Prompt is read from stdin ('-')
          // to avoid any shell-quoting issues with arbitrary user text.
          const newProc = spawn(
            'codex',
            ['exec', '--dangerously-bypass-approvals-and-sandbox', '--color', 'never', 'resume', '--last', '-'],
            { cwd: process.cwd(), shell: process.platform === 'win32', windowsHide: true }
          );
          job.proc = newProc;

          // Write user message to codex stdin
          newProc.stdin?.write(message);
          newProc.stdin?.end();

          newProc.stdout?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          newProc.stderr?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          newProc.on('error', (err: Error) => {
            emit(Buffer.from(`[spawn error: ${err.message}]\n`).toString('base64'));
            job.done = true;
            job.exitCode = -1;
            for (const fn of job.subscribers) fn('__EXIT__:-1');
          });
          newProc.on('close', (code: number | null) => {
            if (job.done) return;
            job.done = true;
            job.exitCode = code;
            for (const fn of job.subscribers) fn(`__EXIT__:${code ?? -1}`);
          });

          jsonReply(res, { ok: true });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      next();
    });
  },
});

const codexChatManager = () => ({
  name: 'codex-chat-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      const jsonReply = (r: any, data: any, status = 200) => {
        r.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        r.end(JSON.stringify(data));
      };

      // ── POST /api/codex-chat/start  →  spawn app-server, connect WS, return sessionId ──
      if (urlPath === '/api/codex-chat/start' && req.method === 'POST') {
        try {
          const sessionId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
          const cwd = process.cwd();
          const port = await findFreePort();

          const proc = spawn(
            'codex',
            [
              'app-server',
              '--listen', `ws://127.0.0.1:${port}`,
              '-c', 'approval_policy="never"',
              '-c', 'search=true',
            ],
            { cwd, shell: process.platform === 'win32', windowsHide: true }
          );

          const session: CodexChatSession = {
            proc, ws: null, threadId: null, nextId: 1,
            subscribers: [], buffer: [], alive: true,
          };
          codexChatSessions.set(sessionId, session);

          const sid = sessionId.slice(0, 8);
          const emit = (type: string, payload?: Record<string, unknown>) => {
            const event = JSON.stringify({ type, ...payload });
            session.buffer.push(event);
            for (const fn of session.subscribers) fn(event);
          };

          const killSession = (code?: number) => {
            if (!session.alive) return;
            session.alive = false;
            if (session.ws) try { session.ws.close(); } catch { /* ignore */ }
            session.ws = null;
            for (const fn of session.subscribers) fn('__SESSION_END__:' + (code ?? -1));
            setTimeout(() => codexChatSessions.delete(sessionId), 30 * 60 * 1000);
          };

          // Forward codex stdout/stderr to the Vite terminal so we can see why it exits
          proc.stdout?.on('data', (d: Buffer) => {
            const msg = d.toString().trimEnd();
            if (msg) server.config.logger.info(`[codex:${sid}] ${msg}`);
          });
          proc.stderr?.on('data', (d: Buffer) => {
            const msg = d.toString().trimEnd();
            if (msg) server.config.logger.warn(`[codex:${sid}] ${msg}`);
          });

          proc.on('error', (err: Error) => {
            server.config.logger.error(`[codex:${sid}] spawn error: ${err.message}`);
            emit('error', { text: 'spawn error: ' + err.message });
            killSession(-1);
          });
          proc.on('close', (code: number | null) => {
            server.config.logger.warn(`[codex:${sid}] process exited with code ${code}`);
            killSession(code ?? -1);
          });

          // Connect WebSocket once the app-server is listening
          (async () => {
            try {
              await waitForPort(port);

              const ws = new WebSocket(`ws://127.0.0.1:${port}`);
              session.ws = ws;

              ws.on('error', (err: Error) => {
                emit('error', { text: 'ws error: ' + err.message });
                killSession(-1);
              });
              ws.on('close', () => killSession(-1));

              ws.on('open', () => {
                ws.send(JSON.stringify({
                  method: 'initialize', id: session.nextId++,
                  params: {
                    clientInfo: { name: 'aralia-dev-hub', title: 'Aralia Dev Hub', version: '1.0.0' },
                    capabilities: { experimentalApi: false },
                  },
                }));
              });

              ws.on('message', (raw: Buffer) => {
                let msg: any;
                try { msg = JSON.parse(raw.toString()); } catch { return; }

                const method: string | undefined = msg.method;
                const params: any = msg.params;

                // Initialize response → start thread
                if (!method && msg.result !== undefined && session.threadId === null) {
                  ws.send(JSON.stringify({
                    method: 'thread/start', id: session.nextId++,
                    params: {
                      cwd,
                      approvalPolicy: 'never',
                      experimentalRawEvents: false,
                      persistExtendedHistory: false,
                    },
                  }));
                  return;
                }

                if (method === 'thread/started') {
                  session.threadId = params?.thread?.id ?? null;
                  emit('sessionReady');
                  return;
                }

                if (method === 'item/agentMessage/delta') {
                  emit('text', { text: params?.delta ?? '' });
                  return;
                }

                if (method === 'turn/completed') {
                  emit('turnComplete');
                  return;
                }

                if (method === 'error') {
                  emit('error', { text: params?.message ?? 'Unknown error' });
                }
              });

            } catch (err: any) {
              emit('error', { text: 'startup error: ' + err.message });
              killSession(-1);
            }
          })();

          jsonReply(res, { sessionId });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      // ── GET /api/codex-chat/:id/stream  →  SSE ────────────────────────────
      const streamMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/stream$/);
      if (streamMatch && req.method === 'GET') {
        const sessionId = streamMatch[1];
        const session = codexChatSessions.get(sessionId);
        if (!session) { jsonReply(res, { error: 'Session not found.' }, 404); return; }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const send = (event: string) => { if (!res.writableEnded) res.write('data: ' + event + '\n\n'); };
        for (const chunk of session.buffer) send(chunk);
        if (!session.alive) send('__SESSION_END__:-1');

        const subscriber = (event: string) => send(event);
        session.subscribers.push(subscriber);

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(': keepalive\n\n');
          else clearInterval(heartbeat);
        }, 25_000);

        req.on('close', () => {
          clearInterval(heartbeat);
          session.subscribers = session.subscribers.filter((fn: any) => fn !== subscriber);
        });
        return;
      }

      // ── POST /api/codex-chat/:id/send  →  turn/start via WS ──────────────
      const sendMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/send$/);
      if (sendMatch && req.method === 'POST') {
        try {
          const sessionId = sendMatch[1];
          const session = codexChatSessions.get(sessionId);
          if (!session || !session.alive || !session.ws || !session.threadId) {
            jsonReply(res, { error: 'Session not ready.' }, 404); return;
          }
          const body = JSON.parse(await readBody(req));
          const message = String(body?.message || '').slice(0, 2000);
          if (!message.trim()) { jsonReply(res, { error: 'Empty message.' }, 400); return; }

          session.ws.send(JSON.stringify({
            method: 'turn/start', id: session.nextId++,
            params: {
              threadId: session.threadId,
              input: [{ type: 'text', text: message, text_elements: [] }],
              approvalPolicy: 'never',
            },
          }));
          jsonReply(res, { ok: true });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      // ── POST /api/codex-chat/:id/kill  →  close WS + SIGTERM ─────────────
      const killMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/kill$/);
      if (killMatch && req.method === 'POST') {
        const sessionId = killMatch[1];
        const session = codexChatSessions.get(sessionId);
        if (!session) { jsonReply(res, { error: 'Session not found.' }, 404); return; }
        if (session.ws) try { session.ws.close(); } catch { /* ignore */ }
        if (session.proc) try { session.proc.kill('SIGTERM'); } catch { /* already exited */ }
        jsonReply(res, { ok: true });
        return;
      }

      next();
    });
  },
});
const portraitApiManager = () => ({
  name: 'portrait-api-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== '/api/portraits/generate' && urlPath !== '/api/portraits/list' && urlPath !== '/api/portraits/cdp/doctor') {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (urlPath === '/api/portraits/list') {
        if (req.method !== 'GET') {
          json({ error: 'Method not allowed.' }, 405);
          return;
        }

        try {
          if (!fs.existsSync(PORTRAIT_OUTPUT_DIR)) {
            json({ files: [], dir: PORTRAIT_OUTPUT_DIR });
            return;
          }

          const files = fs.readdirSync(PORTRAIT_OUTPUT_DIR)
            .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
            .map((name) => {
              const full = path.join(PORTRAIT_OUTPUT_DIR, name);
              const stat = fs.statSync(full);
              return {
                name,
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                url: `assets/images/portraits/generated/${name}`,
              };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs)
            .slice(0, 60);

          json({ files, dir: PORTRAIT_OUTPUT_DIR });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/portraits/cdp/doctor') {
        if (req.method !== 'GET') {
          json({ error: 'Method not allowed.' }, 405);
          return;
        }

        try {
          const { doctorGeminiCDP } = await import('./scripts/workflows/gemini/core/image-gen-mcp.ts');
          const result = await doctorGeminiCDP({
            cdpUrl: process.env.IMAGE_GEN_CDP_URL || 'http://localhost:9222',
            attemptConsent: true,
            openIfMissing: true,
          });
          json(result);
        } catch (e) {
          json({ ok: false, stage: 'error', message: String(e) }, 500);
        }
        return;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        json({ error: 'Method not allowed.' }, 405);
        return;
      }

      try {
        const rawBody = await readBody(req);
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const description = sanitizePromptText(String(parsed?.description || ''), 500);
        const race = sanitizePromptText(String(parsed?.race || ''), 80);
        const className = sanitizePromptText(String(parsed?.className || ''), 80);

        const prompt = [
          'High fantasy character portrait. Head-and-shoulders. Detailed. Dramatic lighting. Neutral background.',
          race ? `Race: ${race}.` : '',
          className ? `Class: ${className}.` : '',
          description ? `Description: ${description}` : '',
          'No text. No UI. No watermark.'
        ].filter(Boolean).join(' ');

        try {
          const url = await generatePortraitWithStitch(prompt);
          json({ url, provider: 'stitch' });
          return;
        } catch (stitchErr) {
          const stitchMessage = stitchErr instanceof Error ? stitchErr.message : String(stitchErr);
          console.warn(`[portraits] Stitch failed, falling back to image-gen. ${stitchMessage}`);

          const url = await generatePortraitWithImageGen(prompt);
          json({ url, provider: 'image-gen' });
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Surface common Stitch setup issues with a clearer hint.
        if (/\[Gcloud\] Token fetch failed/i.test(message) || /Failed to retrieve initial access token/i.test(message)) {
          const configHint = STITCH_GCLOUD_CONFIG ? `CLOUDSDK_CONFIG=\"${STITCH_GCLOUD_CONFIG}\" ` : '';
          json({
            error: [
              'Stitch is not authenticated on this machine.',
              `Run: ${configHint}gcloud.cmd auth application-default login`,
              'Then retry portrait generation. (This endpoint will also attempt an image-gen fallback if configured.)'
            ].join(' ')
          }, 500);
          return;
        }

        if (/Could not connect to Chrome DevTools/i.test(message) || /npm run mcp:chrome/i.test(message)) {
          json({
            error: [
              'Portrait generation could not connect to the debug Chrome session (CDP).',
              'Run: npm run mcp:chrome',
              'In that Chrome window: open https://gemini.google.com/app, accept consent/sign in, then retry.',
              `Details: ${message}`
            ].join(' ')
          }, 500);
          return;
        }

        if (/Before you continue/i.test(message) || /Could not find prompt input for gemini/i.test(message)) {
          json({
            error: [
              'Gemini browser automation is blocked by a consent/sign-in screen.',
              'Preferred fix: npm run mcp:chrome (launch debug Chrome on :9222), open Gemini in that window, accept consent/sign in, then retry.',
              'Fallback fix: npm run image-gen:login (Playwright profile) and accept consent/sign in there.'
            ].join(' ')
          }, 500);
          return;
        }
        json({ error: message || 'Portrait generation failed.' }, 500);
      }
    });
  },
});

// ── PTY Web Terminal ──────────────────────────────────────────────────────────
// Spins up a standalone WebSocketServer on a random port.
// Client fetches the port via GET /api/pty/port, then connects via WebSocket.
// On connect, spawns node-pty with the requested cmd (default: shell).
// Bidirectional: PTY output → ws.send, ws.message → pty.write
//                resize msg  → pty.resize
// Sticky PTY: one persistent PTY per server instance. HMR page-reloads reconnect
// to the same running process instead of spawning a new one.
let _ptyWssPort: number | null = null;
let _stickyPtyProc: ReturnType<typeof pty.spawn> | null = null;
let _ptyClients: Set<WebSocket> = new Set();
let _ptyOutputBuffer = '';          // replay buffer for reconnecting clients
const PTY_BUFFER_CHARS = 200_000;   // ~200 KB of recent output

const ptyTerminalManager = () => ({
  name: 'pty-terminal-manager',
  configureServer(server: any) {
    // Standalone WSS on OS-assigned free port (avoids Vite HMR conflict)
    const wss = new WebSocketServer({ port: 0 });

    wss.on('listening', () => {
      const addr = wss.address() as { port: number };
      _ptyWssPort = addr.port;
      server.config.logger.info(`[pty] WebSocket server ready on port ${_ptyWssPort}`);
    });

    const spawnStickyPty = () => {
      const cmd = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      const sid = Math.random().toString(16).slice(2, 10);
      try {
        _stickyPtyProc = pty.spawn(cmd, [], {
          name: 'xterm-256color',
          cols: 220,
          rows: 50,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        });
        server.config.logger.info(`[pty:${sid}] spawned sticky "${cmd}"`);
      } catch (err: any) {
        server.config.logger.error(`[pty:${sid}] spawn failed: ${err.message}`);
        return;
      }

      _stickyPtyProc.onData((data: string) => {
        _ptyOutputBuffer += data;
        if (_ptyOutputBuffer.length > PTY_BUFFER_CHARS) {
          _ptyOutputBuffer = _ptyOutputBuffer.slice(-PTY_BUFFER_CHARS);
        }
        for (const client of _ptyClients) {
          if (client.readyState === WebSocket.OPEN) client.send(data);
        }
      });

      _stickyPtyProc.onExit(({ exitCode }: { exitCode: number }) => {
        server.config.logger.info(`[pty:${sid}] exited with code ${exitCode}`);
        _stickyPtyProc = null;
        _ptyOutputBuffer = '';
        for (const client of _ptyClients) {
          if (client.readyState === WebSocket.OPEN) client.close();
        }
        _ptyClients.clear();
      });
    };

    wss.on('connection', (ws: WebSocket, _req: any) => {
      // Spawn sticky PTY if none exists yet
      if (!_stickyPtyProc) spawnStickyPty();

      _ptyClients.add(ws);

      // Replay recent output so reconnecting client catches up
      if (_ptyOutputBuffer.length > 0) {
        ws.send(_ptyOutputBuffer);
      }

      ws.on('message', (msg: Buffer) => {
        if (!_stickyPtyProc) return;
        try {
          const d = JSON.parse(msg.toString());
          if (d.type === 'input')  _stickyPtyProc.write(d.data);
          if (d.type === 'resize') _stickyPtyProc.resize(Math.max(2, d.cols), Math.max(2, d.rows));
        } catch {
          _stickyPtyProc.write(msg.toString());
        }
      });

      ws.on('close', () => {
        _ptyClients.delete(ws);
        // Do NOT kill the PTY on disconnect — it stays alive for reconnects.
        // PTY only dies when the process itself exits.
      });
    });

    // REST endpoint so the client can discover the WSS port
    server.middlewares.use((req: any, res: any, next: any) => {
      if ((req.url || '').split('?')[0] === '/api/pty/port') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ port: _ptyWssPort }));
        return;
      }
      next();
    });
  },
});

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const isDevServer = command === 'serve';
  const isRoadmapMode = mode === 'roadmap';
  const isRoadmapOnlyDev = isDevServer && isRoadmapMode;
  const roadmapServer = isRoadmapOnlyDev ? await getRoadmapDevServerStatus() : null;
  const ollamaTarget = 'http://localhost:11434/api';
  const imageTarget = 'http://localhost:3001';

  // ============================================================================
  // Dev Profile Isolation
  // ============================================================================
  // Technical:
  // The main app and roadmap tool can run as separate dev profiles so HMR updates
  // in one profile do not bounce the other profile's browser session.
  //
  // Layman:
  // This is the keep-roadmap-separate switch.
  // - Normal npm run dev: game app only, roadmap files are ignored by file watching.
  // - vite --mode roadmap: roadmap only, on a separate port.
  // ============================================================================
  const mainDevRoadmapWatchIgnored = [
    '**/.agent/roadmap/**',
    '**/.agent/roadmap-local/**',
    '**/devtools/roadmap/**'
  ];

  // ============================================================================
  // Plugin Profiles
  // ============================================================================
  // Technical:
  // Main profile keeps existing dev tooling but intentionally excludes roadmap API
  // middleware. Roadmap-only profile includes only the roadmap middleware plus React.
  //
  // Layman:
  // We load only the tools each profile needs, so roadmap edits do not poke the
  // main app server and main app edits do not disturb the roadmap server.
  // ============================================================================
  const mainPlugins = [
    react(),
    visualizerManager(),
    roadmapManager(),
    roadmapLauncherManager(),
    conductorManager(),
    scanManager(),
    gitStatusManager(),
    devHubApiManager(),
    glossarySpellGateManager(),
    glossaryIndexManager(),
    scriptRegistryManager(),
    portraitApiManager(),
    codexRunManager(),
    codexChatManager(),
    ptyTerminalManager()
  ];
  const roadmapOnlyPlugins = [react(), roadmapManager()];
  const plugins = isRoadmapOnlyDev ? roadmapOnlyPlugins : mainPlugins;

  // ============================================================================
  // Build Entry Gating
  // ============================================================================
  // Technical:
  // Roadmap HTML entries are only added when explicitly building in roadmap mode.
  // This avoids pulling roadmap bundles into regular app builds by accident.
  //
  // Layman:
  // The roadmap page now joins builds only when you ask for roadmap mode on purpose.
  // ============================================================================
  const includeRoadmapBuildEntries = isRoadmapMode;

  if (isDevServer) {
    if (isRoadmapOnlyDev) {
      if (roadmapServer?.running) {
        // Technical: roadmap mode is intentionally single-port. If another roadmap server
        // already owns that port, print the active URL and exit cleanly instead of letting
        // Vite spill over to 3011/3012 and leaving multiple roadmap servers around.
        // Layman: when roadmap is already running, this command now tells you where it is
        // and stops, rather than secretly starting a second copy on another port.
        console.info(`[dev] Roadmap server already active on port ${ROADMAP_DEV_PORT}.`);
        console.info(`[dev] Open: ${roadmapServer.openUrl}`);
        setTimeout(() => process.exit(0), 0);
      }
      console.info('[dev] Mode: roadmap-only (isolated from main app HMR).');
      console.info(`[dev] Roadmap server port: ${ROADMAP_DEV_PORT}`);
      console.info(`[dev] Open: ${ROADMAP_DEV_OPEN_PATH}`);
    } else {
      console.info('[dev] Mode: main-app (roadmap APIs and roadmap watch paths are disabled).');
      console.info('[dev] Proxy routes:');
      console.info('[dev] /api/ollama -> ' + ollamaTarget + ' (Ollama server)');
      console.info('[dev] /api/image-gen -> ' + imageTarget + ' (image server)');
      console.info('[dev] /generated -> ' + imageTarget + ' (image server)');
    }
  }

  return {
    base: '/Aralia/',
    server: {
      // WHAT CHANGED: Strict port and persistent port for Roadmap server.
      // WHY IT CHANGED: When running in Roadmap-only mode (npm run dev:roadmap), 
      // we want a predictable port (3010) so that the main app's proxy 
      // can always find it. `strictPort` ensures it doesn't drift if 
      // already occupied, making the proxy connection reliable.
      port: isRoadmapOnlyDev ? ROADMAP_DEV_PORT : 3000,
      strictPort: isRoadmapOnlyDev,
      host: '0.0.0.0',
      ...(isRoadmapOnlyDev
        ? {}
        : {
            watch: {
              ignored: mainDevRoadmapWatchIgnored
            },
            proxy: {
              '/api/ollama': addProxyDiagnostics(
                '/api/ollama',
                // WHAT CHANGED: Wrapped proxies in diagnostic helper.
                // WHY IT CHANGED: Identifying why a dev server proxy failed 
                // used to require checking Vite's internal debug logs. 
                // `addProxyDiagnostics` provides human-readable hints 
                // in the console for common issues like 'Ollama not running', 
                // drastically reducing setup friction for new agents.
                {
                  target: ollamaTarget,
                  changeOrigin: true,
                  rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
                },
                'Start Ollama (ollama serve) or update the target in vite.config.ts.'
              ),
              '/api/image-gen': addProxyDiagnostics(
                '/api/image-gen',
                {
                  target: imageTarget,
                  changeOrigin: true,
                },
                'Start the image server on port 3001 or update the target in vite.config.ts.'
              ),
              '/generated': addProxyDiagnostics(
                '/generated',
                {
                  target: imageTarget,
                  changeOrigin: true,
                },
                'Start the image server on port 3001 or update the target in vite.config.ts.'
              )
            }
          })
    },
    plugins,
    define: {
      // Shim process.env for legacy support (allows process.env.API_KEY to work).
      // New code should prefer import.meta.env.VITE_GEMINI_API_KEY.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      // Force a single Three.js instance — @react-three/postprocessing and the
      // takram packages can pull in their own bundled copy, causing vNormal
      // redefinition shader crashes. dedupe forces Vite to resolve all `three`
      // imports to the same copy without bypassing the package exports map
      // (which a raw path alias would do, breaking three/addons/* imports).
      dedupe: ['three', '@react-three/fiber', '@react-three/drei'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          // TODO(2026-01-03 pass 5 Codex-CLI): misc/design.html is local-only and ignored, so guard its entry to keep CI builds green.
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'design.html'))
            ? { design: path.resolve(__dirname, 'misc', 'design.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'dev_hub.html'))
            ? { dev_hub: path.resolve(__dirname, 'misc', 'dev_hub.html') }
            : {}),
          // This gives the standalone spell validation page its own build entry
          // so it can live beside the Dev Hub without being treated as a hidden
          // sub-panel that only exists inside that larger page.
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'spell_data_validation.html'))
            ? { spell_data_validation: path.resolve(__dirname, 'misc', 'spell_data_validation.html') }
            : {}),
          // Standalone Spell Pipeline Atlas — bucket dashboard + execution maps +
          // coverage matrix. Lives beside spell_data_validation.html so the Dev
          // Hub can link to it directly without routing through DesignPreview.
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'spell_pipeline_atlas.html'))
            ? { spell_pipeline_atlas: path.resolve(__dirname, 'misc', 'spell_pipeline_atlas.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'agent_docs.html'))
            ? { agent_docs: path.resolve(__dirname, 'misc', 'agent_docs.html') }
            : {}),
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html'))
            ? { roadmap: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html') }
            : {}),
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html'))
            ? { roadmap_docs: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html') }
            : {})
        },
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'framer-motion'],
            'vendor-utils': ['lucide-react', 'marked', 'dompurify', 'uuid', 'zod'],
            'vendor-pixi': ['pixi.js'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    }
  };
});
