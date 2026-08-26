/**
 * This file is the runtime entry point for the modularized visualizer server.
 *
 * It decides between headless `--sync` mode and interactive server mode, routes
 * API requests to `api.ts`, serves client assets from `client/`, and now keeps
 * the local developer server bound to loopback instead of force-killing anything
 * else that happens to be on the same port.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { handleApiRequest } from './api';
import { syncFilesScoped, printScopedSyncReport, checkFileDependencies, collectSyncedFilePaths } from './sync';
import { generateGraphData } from './graphBuilder';

// ============================================================================
// Server Configuration
// ============================================================================
// These values define the default host port and where client assets are loaded
// from when serving the browser UI.
// ============================================================================

const PORT = 3847;
const HOST = '127.0.0.1';
const PROJECT_ROOT = process.cwd();
const CLIENT_DIR = path.join(PROJECT_ROOT, 'misc', 'dev_hub', 'codebase-visualizer', 'client');

// ============================================================================
// Static File Serving
// ============================================================================
// These helpers map URL paths into the client folder and enforce a strict
// no-traversal policy before reading any file from disk.
// ============================================================================

function getMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

function resolveClientPath(urlPath: string): string | null {
  const normalizedPath = urlPath === '/' ? '/index.html' : urlPath;

  // Only allow known static folders to avoid exposing arbitrary project files.
  const isAllowed = normalizedPath === '/index.html'
    || normalizedPath.startsWith('/css/')
    || normalizedPath.startsWith('/js/')
    || normalizedPath.startsWith('/vendor/');
  if (!isAllowed) return null;

  // Sanitize path and enforce containment within CLIENT_DIR.
  const relativePath = normalizedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(CLIENT_DIR, relativePath);
  if (!resolvedPath.startsWith(CLIENT_DIR)) return null;
  return resolvedPath;
}

function serveClientAsset(urlPath: string, res: http.ServerResponse): boolean {
  const filePath = resolveClientPath(urlPath);
  if (!filePath) return false;

  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(content);
    return true;
  } catch (error) {
    console.error('Failed to serve client asset:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
    return true;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================
// `--sync` runs dependency header mutation. Without `--sync`, we boot the HTTP
// server and route API + static client requests.
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shutdownToken = randomBytes(24).toString('hex');

  // Headless sync mode keeps compatibility with existing workflow commands.
  //
  // WF-G115: `--sync` now takes any number of paths and builds the dependency
  // graph once for all of them, so an orchestrator can run a single pass over a
  // whole wave instead of paying ~3 minutes per file. `--only` is the shared-
  // checkout mode: it asserts that nothing outside the named list is written and
  // reports the dependents it deliberately left alone as stale. `--dry-run`
  // reports without writing.
  if (args.includes('--sync')) {
    const syncIndex = args.indexOf('--sync');
    const targetPaths = args.slice(syncIndex + 1).filter((arg) => !arg.startsWith('--'));
    const only = args.includes('--only');
    const dryRun = args.includes('--dry-run');

    if (targetPaths.length === 0) {
      console.error('Error: Please provide at least one file path.');
      console.error('Usage: npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [--only] [--dry-run] path/to/a.ts path/to/b.tsx');
      process.exit(1);
    }

    const report = await syncFilesScoped(targetPaths, { only, dryRun });
    printScopedSyncReport(report);
    return;
  }

  // Headless drift-check mode (GG-84). Verifies that recorded advisory headers
  // still match the live dependency graph, ignoring timestamps. Optional file
  // paths after `--check` restrict the scan; otherwise every header under src/
  // is checked. Exits non-zero when any header has drifted.
  if (args.includes('--check')) {
    const checkIndex = args.indexOf('--check');
    const explicitPaths = args.slice(checkIndex + 1);
    const graph = await generateGraphData();
    const targetPaths = explicitPaths.length > 0 ? explicitPaths : collectSyncedFilePaths();

    const results = targetPaths.map((p) => checkFileDependencies(p, graph));
    const failures = results.filter((r) => !r.ok);

    console.info(`[check] Checked ${results.length} advisory header(s); ${failures.length} drifted.`);
    for (const failure of failures) {
      console.warn(`[check] DRIFT ${failure.file} (${failure.reason})`);
      if (failure.expected) console.warn(`        expected: ${failure.expected}`);
      if (failure.actual) console.warn(`        actual:   ${failure.actual}`);
    }

    process.exit(failures.length > 0 ? 1 : 0);
  }

  let server: http.Server;

  // Build the HTTP server as a loopback-only developer tool. Same-origin page
  // loads still work, but other sites no longer get wildcard CORS access.
  server = http.createServer(async (req, res) => {
    const requestPath = getPathname(req.url);
    const isApiRequest = requestPath.startsWith('/api/');

    if (isApiRequest && applyApiCorsHeaders(req, res)) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
    }

    // Delegate API requests first so route behavior stays centralized.
    const apiHandled = await handleApiRequest(req, res, {
      port: PORT,
      shutdownToken,
      requestShutdown: () => {
        setTimeout(() => {
          server.close(() => {
            console.log('Server shut down gracefully');
            process.exit(0);
          });
        }, 100);
      },
    });
    if (apiHandled) return;

    const staticHandled = serveClientAsset(requestPath, res);
    if (staticHandled) return;

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  // Binding to loopback closes off the biggest accidental exposure path without
  // changing how the local browser UI talks to the server.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error('');
      console.error('Codebase Visualizer Server could not start because port ' + PORT + ' is already in use.');
      console.error('Stop the existing listener or choose a different port before retrying.');
      console.error('');
      process.exit(1);
    }

    console.error('Visualizer server failed to start:', error);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('Codebase Visualizer Server running at:');
    console.log('  http://localhost:' + PORT);
    console.log('  http://' + HOST + ':' + PORT);
    console.log('');
    console.log('Local shutdown token for POST /api/shutdown:');
    console.log('  ' + shutdownToken);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  });
}

function getPathname(rawUrl: string | undefined): string {
  const value = rawUrl ?? '/';
  const queryIndex = value.indexOf('?');
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function applyApiCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return false;
  }

  let hostname = '';
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  const isLoopbackOrigin = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLoopbackOrigin) {
    return false;
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Visualizer-Shutdown-Token');
  return true;
}

main().catch((error) => {
  console.error('Fatal visualizer server error:', error);
  process.exit(1);
});
