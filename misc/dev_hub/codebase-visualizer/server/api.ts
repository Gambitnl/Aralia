/**
 * This file handles all `/api/*` routes for the visualizer server.
 *
 * The main HTTP server delegates API requests here so request parsing, graph
 * generation, scan execution, and shutdown behavior stay isolated from static
 * file serving concerns.
 */

import * as http from 'http';
import { exec } from 'child_process';
import { generateGraphData } from './graphBuilder';

// ============================================================================
// API Handler Contract
// ============================================================================
// The server injects runtime dependencies (port and shutdown callback) so this
// module remains focused on route behavior only.
// ============================================================================

export interface ApiContext {
  port: number;
  shutdownToken: string;
  requestShutdown: () => void;
}

// ============================================================================
// API Router
// ============================================================================
// Returns true when a request was handled so the caller can avoid duplicate
// routing logic in the main server file.
// ============================================================================

export async function handleApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  context: ApiContext,
): Promise<boolean> {
  const pathname = getPathname(req.url);
  const method = req.method || 'GET';

  // Keep every API route local-only so the visualizer stays a workstation tool
  // instead of becoming a network-exposed service by accident.
  if (!isLocalRequest(req)) {
    writeJson(res, 403, { error: 'Local access only' });
    return true;
  }

  // Health check used by local tooling to confirm the server is alive.
  if (pathname === '/api/health') {
    if (method !== 'GET') {
      writeMethodNotAllowed(res, ['GET']);
      return true;
    }
    writeJson(res, 200, { status: 'ok', port: context.port });
    return true;
  }

  // Shutdown is preserved for local orchestrators, but it now requires both
  // an explicit POST request and the per-session token printed at startup.
  if (pathname === '/api/shutdown') {
    if (method !== 'POST') {
      writeMethodNotAllowed(res, ['POST']);
      return true;
    }

    const providedToken = req.headers['x-visualizer-shutdown-token'];
    if (providedToken !== context.shutdownToken) {
      writeJson(res, 403, { error: 'Invalid shutdown token' });
      return true;
    }

    console.log('[' + new Date().toLocaleTimeString() + '] Shutdown requested via API');
    writeJson(res, 200, { status: 'shutting_down' });
    context.requestShutdown();
    return true;
  }

  // Scan stays available to the local UI, but repeated callers can no longer
  // stampede the scanner with overlapping expensive runs.
  if (pathname === '/api/scan') {
    if (method !== 'POST') {
      writeMethodNotAllowed(res, ['POST']);
      return true;
    }

    if (scanInFlight) {
      writeJson(res, 429, { error: 'Scan already running' });
      return true;
    }

    console.log('[' + new Date().toLocaleTimeString() + '] Running code quality scan...');
    scanInFlight = true;
    exec(
      'npx tsx scripts/scan-quality.ts --json',
      { cwd: process.cwd(), timeout: 30000, windowsHide: true },
      (error, stdout, stderr) => {
        scanInFlight = false;

        if (error) {
          writeJson(res, 500, { error: 'Scan failed', message: stderr || error.message });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(stdout.trim());
      },
    );
    return true;
  }

  // Graph route returns a fresh dependency map for UI refresh actions.
  if (pathname === '/api/graph') {
    if (method !== 'GET') {
      writeMethodNotAllowed(res, ['GET']);
      return true;
    }

    console.log('[' + new Date().toLocaleTimeString() + '] Regenerating graph data...');
    try {
      const data = await getGraphData({ forceRefresh: hasTruthyQueryFlag(req.url, 'refresh') });
      console.log('[' + new Date().toLocaleTimeString() + '] Done: ' + data.nodes.length + ' nodes, ' + data.edges.length + ' edges');
      writeJson(res, 200, data);
    } catch (error) {
      console.error('Error generating graph:', error);
      writeJson(res, 500, { error: 'Failed to generate graph data' });
    }
    return true;
  }

  return false;
}

// ============================================================================
// Route Helpers
// ============================================================================
// These helpers keep path parsing and JSON responses consistent across routes.
// ============================================================================

let scanInFlight = false;
let cachedGraphData: { data: Awaited<ReturnType<typeof generateGraphData>>; expiresAt: number } | null = null;
let graphInFlight: Promise<Awaited<ReturnType<typeof generateGraphData>>> | null = null;
const GRAPH_CACHE_TTL_MS = 5000;

function getPathname(rawUrl: string | undefined): string {
  const value = rawUrl ?? '/';
  const queryIndex = value.indexOf('?');
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function isLocalRequest(req: http.IncomingMessage): boolean {
  const remoteAddress = req.socket.remoteAddress || '';
  return remoteAddress === '127.0.0.1'
    || remoteAddress === '::1'
    || remoteAddress === '::ffff:127.0.0.1';
}

async function getGraphData(options: { forceRefresh: boolean }): Promise<Awaited<ReturnType<typeof generateGraphData>>> {
  const now = Date.now();
  if (!options.forceRefresh && cachedGraphData && cachedGraphData.expiresAt > now) {
    return cachedGraphData.data;
  }

  if (!options.forceRefresh && graphInFlight) {
    return graphInFlight;
  }

  graphInFlight = generateGraphData()
    .then((data) => {
      cachedGraphData = {
        data,
        expiresAt: Date.now() + GRAPH_CACHE_TTL_MS,
      };
      return data;
    })
    .finally(() => {
      graphInFlight = null;
    });

  return graphInFlight;
}

function hasTruthyQueryFlag(rawUrl: string | undefined, key: string): boolean {
  if (!rawUrl) return false;

  try {
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const value = parsedUrl.searchParams.get(key);
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

function writeMethodNotAllowed(res: http.ServerResponse, allowedMethods: string[]): void {
  res.setHeader('Allow', allowedMethods.join(', '));
  writeJson(res, 405, { error: 'Method not allowed', allowed: allowedMethods });
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}
