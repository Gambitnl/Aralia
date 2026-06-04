import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { readBody, stripMarkdownInline, toProjectSlug, projectSlugFromNorthStarPath } from './utils';

export const ROADMAP_DEV_PORT = 3010;
export const ROADMAP_DEV_HOST = '127.0.0.1';
export const ROADMAP_DEV_OPEN_PATH = '/Aralia/devtools/roadmap/roadmap.html';
export const ROADMAP_DEV_HEALTH_URL = `http://${ROADMAP_DEV_HOST}:${ROADMAP_DEV_PORT}/api/roadmap/data`;
export const ROADMAP_DEV_OPEN_URL = `http://${ROADMAP_DEV_HOST}:${ROADMAP_DEV_PORT}${ROADMAP_DEV_OPEN_PATH}`;

export type RoadmapDevServerStatus = {
  running: boolean;
  openUrl: string;
  healthUrl: string;
};

export const getRoadmapDevServerStatus = async (): Promise<RoadmapDevServerStatus> => {
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

export const roadmapLauncherManager = () => ({
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

export const roadmapManager = () => ({
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

    const isSafeRoadmapNodeId = (value: string) => /^[a-zA-Z0-9:_-]+$/.test(value);

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
      const {
        generateRoadmapData,
        loadLatestOpportunityScan,
        loadRoadmapHistoryTraceability,
        readOpportunitySettings,
        scanRoadmapOpportunities,
        writeOpportunitySettings,
      } = await import('../../devtools/roadmap/scripts/roadmap-server-logic.ts');

      const pathname = new URL(req.url || '/', 'http://localhost').pathname;

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
            const byId = new Map(roadmap.nodes.map((node: any) => [node.id, node]));

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

    const engineDir = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-engine');
    const bridgePath = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-local-bridge.ts');
    server.watcher.add([engineDir, bridgePath]);
    server.watcher.on('change', async (file: string) => {
      const normalized = file.replace(/\\/g, '/');
      if (normalized.includes('roadmap-engine') || normalized.includes('roadmap-local-bridge')) {
        const { clearRoadmapDataCache } = await import('../../devtools/roadmap/scripts/roadmap-server-logic.ts');
        clearRoadmapDataCache();
        console.info('[roadmap] Data cache cleared due to file change:', path.basename(file));
      }
    });
  }
});
