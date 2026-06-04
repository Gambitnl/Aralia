import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { readBody, execAsync } from './utils';

export const conductorManager = () => ({
  name: 'conductor-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
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

      if (req.url.startsWith('/api/conductor/read')) {
        try {
          const url = new URL(req.url, 'http://localhost');
          const relativePath = url.searchParams.get('path');

          if (!relativePath) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing path param' }));
            return;
          }

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

export const scanManager = () => ({
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

export const gitStatusManager = () => ({
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

const SCRIPT_REGISTRY_PATH = path.resolve(process.cwd(), 'scripts', 'tooling', 'script-registry.json');
const SCRIPT_RUN_LOG_PATH = path.resolve(process.cwd(), 'scripts', 'tooling', '.run-log.json');

export const scriptRegistryManager = () => ({
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
                  type: scriptType,
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

export const glossaryIndexManager = () => ({
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

export const glossarySpellGateManager = () => ({
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
          structuredMismatches: structuredReport.mismatches.filter((mismatch: any) => mismatch.spellId === spellId),
          structuredJsonMismatches: structuredJsonReport.mismatches.filter((mismatch: any) => mismatch.spellId === spellId),
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
