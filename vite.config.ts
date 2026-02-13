import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, exec, execSync } from 'child_process';

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
  const { stdout } = await execAsync(cmd, { shell: true, timeout: 30000 });
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
      { shell: false }
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
  const { generateImage, downloadImage } = await import('./scripts/image-gen-mcp.ts');

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

import { generateRoadmapData } from './scripts/roadmap-server-logic';

const visualizerManager = () => ({
  name: 'visualizer-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/visualizer/start') {
        console.info('[dev] Starting Codebase Visualizer server...');
        try {
          // Use npx tsx to run the script in the background
          const child = spawn('npx', ['tsx', 'scripts/codebase-visualizer-server.ts'], {
            detached: true,
            stdio: 'ignore',
            shell: true,
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
    server.middlewares.use((req: any, res: any, next: any) => {
      // Handle both with and without base path for dev flexibility
      if (req.url === '/api/roadmap/data' || req.url === '/Aralia/api/roadmap/data') {
        try {
          const data = generateRoadmapData();
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(data));
        } catch (error) {
          console.error('[dev] Failed to generate roadmap data:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to generate roadmap data' }));
        }
        return;
      }
      next();
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
        exec('npx tsx scripts/scan-quality.ts --json', { cwd: process.cwd(), timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
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
          const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
          const porcelain = execSync('git status --porcelain', { encoding: 'utf-8' });
          const dirty = porcelain.split('\n').filter(Boolean).length;
          const lastCommit = execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim();
          const lastCommitDate = execSync('git log -1 --format=%cr', { encoding: 'utf-8' }).trim();

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
    server.middlewares.use((req: any, res: any, next: any) => {
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      // Test runner - runs vitest and reads the JSON results file
      if (req.url === '/api/test') {
        exec('npx vitest run', { cwd: process.cwd(), timeout: 120000 }, (_error: any) => {
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
          { cwd: process.cwd(), timeout: 10000 },
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
              .map((d: any) => ({ name: d.name.replace('.md', ''), path: `.agent/${sub}/${d.name}` }));
          };
          const skillsDir = path.join(agentDir, 'skills');
          const skills = fs.existsSync(skillsDir)
            ? fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter((d: any) => d.isDirectory())
                .map((d: any) => ({ name: d.name, path: `.agent/skills/${d.name}/SKILL.md` }))
            : [];
          json({ rules: readMdFiles('rules'), skills, workflows: readMdFiles('workflows') });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      next();
    });
  }
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
          const { doctorGeminiCDP } = await import('./scripts/image-gen-mcp.ts');
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

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const isDevServer = command === 'serve';
  const ollamaTarget = 'http://localhost:11434/api';
  const imageTarget = 'http://localhost:3001';

  if (isDevServer) {
    console.info('[dev] Proxy routes:');
    console.info(`[dev] /api/ollama -> ${ollamaTarget} (Ollama server)`);
    console.info(`[dev] /api/image-gen -> ${imageTarget} (image server)`);
    console.info(`[dev] /generated -> ${imageTarget} (image server)`);
  }

  return {
    base: '/Aralia/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/ollama': addProxyDiagnostics(
          '/api/ollama',
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
    },
    plugins: [react(), visualizerManager(), roadmapManager(), conductorManager(), scanManager(), gitStatusManager(), devHubApiManager(), portraitApiManager()],
    define: {
      // Shim process.env for legacy support (allows process.env.API_KEY to work).
      // New code should prefer import.meta.env.VITE_GEMINI_API_KEY.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
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
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'agent_docs.html'))
            ? { agent_docs: path.resolve(__dirname, 'misc', 'agent_docs.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'roadmap.html'))
            ? { roadmap: path.resolve(__dirname, 'misc', 'roadmap.html') }
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
