import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import type { DevHubRouteContext } from './routeContext';

export async function handleCiTestRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json } = ctx;

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
