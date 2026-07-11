import { request as httpRequest } from 'http';
import { Socket } from 'net';
import { stripMarkdownInline } from '../utils';
import type { DevHubRouteContext } from './routeContext';

const DEV_SERVER_SCAN_TIMEOUT_MS = 1200;
const DEV_SERVER_SCAN_HOST = '127.0.0.1';
const DEV_SERVER_SCAN_DEFAULT_CONCURRENCY = 24;
const DEV_SERVER_SCAN_MAX_RANGE = 4000;
const DEV_SERVER_SCAN_MIN_PORT = 1;
const DEV_SERVER_SCAN_MAX_PORT = 65535;
const DEV_SERVER_SCAN_TARGETS = {
  3000: 'Core App',
  3010: 'Roadmap',
  3030: 'Dev Hub',
  3040: 'Operator Dashboard',
  3847: 'Codebase Visualizer',
  3001: 'Image Server',
  9222: 'Chrome Debugger',
  11434: 'Ollama',
};
const DEV_SERVER_SCAN_LABELS = Object.keys(DEV_SERVER_SCAN_TARGETS).map((value) => Number(value));

const toTitleFromHtml = (value: string) => {
  const match = String(value || '').match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return stripMarkdownInline(match[1]).replace(/\s+/g, ' ').trim();
};

const buildScanTargetsFromRange = (start: number, end: number, includeKnown = true) => {
  const safeStart = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Math.floor(start || DEV_SERVER_SCAN_MIN_PORT)));
  const safeEnd = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Math.floor(end || DEV_SERVER_SCAN_MAX_PORT)));
  const fromPort = Math.min(safeStart, safeEnd);
  const toPort = Math.max(safeStart, safeEnd);

  return Array.from({ length: Math.max(0, toPort - fromPort + 1) }, (_, index) => {
    const port = fromPort + index;
    return {
      port,
      label: includeKnown && DEV_SERVER_SCAN_LABELS.includes(port)
        ? DEV_SERVER_SCAN_TARGETS[port]
        : 'Unknown service',
      expectedUrl: `http://${DEV_SERVER_SCAN_HOST}:${port}/`,
    };
  });
};

const buildScanTargets = (includeKnown = true, start?: number, end?: number, scanAll = false) => {
  if (scanAll) {
    return buildScanTargetsFromRange(DEV_SERVER_SCAN_MIN_PORT, DEV_SERVER_SCAN_MAX_PORT, includeKnown);
  }
  return buildScanTargetsFromRange(start ?? DEV_SERVER_SCAN_MIN_PORT, end ?? DEV_SERVER_SCAN_MIN_PORT, includeKnown);
};

const probeHttpUrl = async (
  target: { port: number; label: string; expectedUrl: string; },
  checkedPath = '/',
  timeoutMs = DEV_SERVER_SCAN_TIMEOUT_MS,
) => {
  const checkedUrl = `http://${DEV_SERVER_SCAN_HOST}:${target.port}${checkedPath}`;
  const startMs = Date.now();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEV_SERVER_SCAN_TIMEOUT_MS;

  return new Promise<any>((resolve) => {
    const request = httpRequest(
      {
        method: 'GET',
        host: DEV_SERVER_SCAN_HOST,
        port: target.port,
        path: checkedPath,
        headers: {
          'User-Agent': 'Aralia-Active-Dev-Server-Scanner/1.0',
        },
        timeout,
      },
      (response: any) => {
        const statusCode = Number(response.statusCode);
        let title = '';
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          if (!title && responseBody.length < 4096) {
            responseBody += String(chunk || '');
            title = toTitleFromHtml(responseBody);
          }
          if (responseBody.length > 4096) {
            response.resume();
            response.destroy();
          }
        });
        response.on('end', () => {
          resolve({
            port: target.port,
            label: target.label,
            expectedUrl: target.expectedUrl,
            active: true,
            activeUrl: checkedUrl,
            checkedUrl,
            checkedPath,
            httpStatus: statusCode || 0,
            httpStatusText: String(response.statusMessage || ''),
            responseMs: Date.now() - startMs,
            title,
          });
        });
        response.resume();
      },
    );

    request.on('error', (error: any) => {
      resolve({
        port: target.port,
        label: target.label,
        expectedUrl: target.expectedUrl,
        active: false,
        checkedUrl,
        checkedPath,
        error: error?.message || 'Request failed',
        responseMs: Date.now() - startMs,
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Probe request timed out.'));
    });

    request.end();
  });
};

const probeWebSocketUpgrade = async (target: { port: number; }, timeoutMs = DEV_SERVER_SCAN_TIMEOUT_MS) => {
  const secWebSocketKey = 'dGhlIHNhbXBsZSBub25jZQ==';
  const socket = new Socket();
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEV_SERVER_SCAN_TIMEOUT_MS;
  const timeout = setTimeout(() => socket.destroy(new Error('WebSocket probe timed out.')), safeTimeout);
  return new Promise<{ upgradeProbeStatus?: number; upgradeProbeError?: string }>((resolve) => {
    let handled = false;
    let responseData = '';
    const finish = (payload: { upgradeProbeStatus?: number; upgradeProbeError?: string; }) => {
      if (handled) return;
      handled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(payload);
    };

    socket.connect(target.port, DEV_SERVER_SCAN_HOST, () => {
      const requestLines = [
        'GET / HTTP/1.1',
        `Host: ${DEV_SERVER_SCAN_HOST}:${target.port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${secWebSocketKey}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ];
      socket.write(requestLines.join('\r\n'));
    });

    socket.on('data', (chunk: Buffer) => {
      responseData += chunk.toString('utf8');
      const match = responseData.match(/^HTTP\/\d+\.\d+\s+(\d+)\b/);
      if (!match) return;
      const status = Number(match[1]);
      if (Number.isFinite(status)) {
        finish({ upgradeProbeStatus: status });
      } else {
        finish({ upgradeProbeError: 'Invalid upgrade response.' });
      }
    });

    socket.on('error', (error: any) => {
      finish({ upgradeProbeError: error?.message || 'WebSocket probe failed.' });
    });
    socket.on('close', () => {
      finish({});
    });
  });
};

const scanDevServer = async (target: { port: number; label: string; expectedUrl: string; }) => {
  const base = await probeHttpUrl(target);
  if (!base.active) return base;
  if (base.httpStatus === 426) {
    const upgrade = await probeWebSocketUpgrade(target, DEV_SERVER_SCAN_TIMEOUT_MS);
    return {
      ...base,
      protocolProbe: upgrade.upgradeProbeStatus === 101 ? 'websocket' : '',
      upgradeProbeStatus: upgrade.upgradeProbeStatus,
      upgradeProbeError: upgrade.upgradeProbeError,
    };
  }
  return base;
};

const scanDevServerTargets = async (targets: Array<{ port: number; label: string; expectedUrl: string; }>, concurrency = DEV_SERVER_SCAN_DEFAULT_CONCURRENCY) => {
  const results: Array<any> = [];
  const limit = Math.max(1, Math.min(200, Number.isFinite(concurrency) ? Math.floor(concurrency) : DEV_SERVER_SCAN_DEFAULT_CONCURRENCY));
  let index = 0;

  const worker = async () => {
    while (index < targets.length) {
      const target = targets[index++];
      results.push(await scanDevServer(target));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, targets.length) }, () => worker())
  );
  return results.sort((left: any, right: any) => left.port - right.port);
};

export async function handleDevServerRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { json, parsedUrl, urlPath } = ctx;

  if (urlPath === '/api/dev/active-servers' || urlPath === '/Aralia/api/dev/active-servers') {
    try {
      const rawStart = Number(parsedUrl.searchParams.get('start'));
      const rawEnd = Number(parsedUrl.searchParams.get('end'));
      const rawRangeLimit = Number(parsedUrl.searchParams.get('rangeLimit'));
      const includeKnown = parsedUrl.searchParams.get('includeKnown') !== '0';
      const scanAll = parsedUrl.searchParams.get('scanAll') === '1';
      const concurrency = Number(parsedUrl.searchParams.get('concurrency'));
      const requestedLimit = Number.isFinite(rawRangeLimit) ? Math.floor(rawRangeLimit) : DEV_SERVER_SCAN_MAX_RANGE;
      const rangeLimit = Math.max(1, Math.min(DEV_SERVER_SCAN_MAX_RANGE, requestedLimit));
      const startPort = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Number.isFinite(rawStart) ? Math.floor(rawStart) : 3000));
      const endPort = Math.max(DEV_SERVER_SCAN_MIN_PORT, Math.min(DEV_SERVER_SCAN_MAX_PORT, Number.isFinite(rawEnd) ? Math.floor(rawEnd) : 3100));

      if (!scanAll && Math.abs(endPort - startPort) + 1 > DEV_SERVER_SCAN_MAX_RANGE) {
        json({
          error: `Requested range is too large. Increase rangeLimit, use scanAll=1, or reduce end-start+1 to <= ${DEV_SERVER_SCAN_MAX_RANGE}.`,
        }, 400);
        return true;
      }

      const resolvedConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : DEV_SERVER_SCAN_DEFAULT_CONCURRENCY;
      const scanRanges: Array<{ start: number; end: number }> = [];
      const serverRows: Array<any> = [];
      const targets: Array<{ port: number; label: string; expectedUrl: string }> = [];
      const scanStart = Math.min(startPort, endPort);
      const scanEnd = Math.max(startPort, endPort);
      if (scanAll) {
        for (let rangeStart = DEV_SERVER_SCAN_MIN_PORT; rangeStart <= DEV_SERVER_SCAN_MAX_PORT; rangeStart += rangeLimit) {
          const rangeEnd = Math.min(rangeStart + rangeLimit - 1, DEV_SERVER_SCAN_MAX_PORT);
          const chunkTargets = buildScanTargetsFromRange(rangeStart, rangeEnd, includeKnown);
          scanRanges.push({ start: rangeStart, end: rangeEnd });
          const scannedChunk = await scanDevServerTargets(chunkTargets, resolvedConcurrency);
          targets.push(...chunkTargets);
          serverRows.push(...scannedChunk);
        }
      } else {
        const chunkTargets = buildScanTargets(includeKnown, scanStart, scanEnd, scanAll);
        scanRanges.push({ start: scanStart, end: scanEnd });
        const scannedChunk = await scanDevServerTargets(chunkTargets, resolvedConcurrency);
        targets.push(...chunkTargets);
        serverRows.push(...scannedChunk);
      }

      json({
        scannedAt: new Date().toISOString(),
        scanTimeoutMs: DEV_SERVER_SCAN_TIMEOUT_MS,
        totalPortsChecked: serverRows.length,
        activeCount: serverRows.filter((server) => Boolean(server.active)).length,
        scanRange: scanAll ? { start: DEV_SERVER_SCAN_MIN_PORT, end: DEV_SERVER_SCAN_MAX_PORT } : { start: scanStart, end: scanEnd },
        includeKnown,
        scannedRanges: scanRanges,
        concurrency: resolvedConcurrency,
        rangeLimit,
        scanAll,
        targets,
        servers: serverRows,
      });
    } catch (error) {
      json({ error: String(error) }, 500);
    }
    return true;
  }

  return false;
}
