import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import type { DevHubRouteContext } from './routeContext';

export async function handleCiTestRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json } = ctx;

  if (req.url === '/api/test') {
    // Each request owns one report file. Concurrent dashboard requests therefore
    // cannot read a worker's stale or neighbouring result, and cleanup is local.
    const resultsDir = path.join(os.tmpdir(), 'aralia-devhub-vitest');
    fs.mkdirSync(resultsDir, { recursive: true });
    const resultsPath = path.join(resultsDir, `results-${process.pid}-${Date.now()}-${crypto.randomUUID()}.json`);
    exec('npx vitest run', {
      cwd: process.cwd(),
      timeout: 120000,
      windowsHide: true,
      env: { ...process.env, VITEST_JSON_OUTPUT_FILE: resultsPath },
    }, (_error: any) => {
      try {
        if (fs.existsSync(resultsPath)) {
          const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
          json(results);
        } else {
          json({ error: 'No invocation-scoped Vitest report produced' });
        }
      } catch (e) {
        json({ error: 'Parse failed', message: String(e) });
      } finally {
        fs.rmSync(resultsPath, { force: true });
      }
    });
    return true;
  }

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
    return true;
  }

  return false;
}
