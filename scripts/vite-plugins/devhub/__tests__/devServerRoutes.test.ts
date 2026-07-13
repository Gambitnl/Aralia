import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import { probeHttpUrl } from '../devServerRoutes';

/**
 * Regression coverage for the port-probe hang.
 *
 * A local server that returns a body larger than 4 KB (e.g. the Agora daemon
 * on :4319, which serves ~91 KB of HTML) used to freeze the whole scan: the
 * probe destroyed the response once the body passed 4 KB, but only resolved on
 * the 'end' event — which never fires after a destroy. The dead promise blocked
 * its scan worker, so Promise.all never settled and the browser's fetch for
 * that chunk hung forever. These tests assert the probe always resolves.
 */

const openServers: Server[] = [];

async function listen(server: Server): Promise<number> {
  openServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address.');
  }
  return address.port;
}

function target(port: number) {
  return { port, label: 'Test service', expectedUrl: `http://127.0.0.1:${port}/` };
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

describe('probeHttpUrl', () => {
  it('resolves active for a server that returns a body larger than 4 KB', async () => {
    const bigHtml = `<html><head><title>Big Page</title></head><body>${'x'.repeat(100_000)}</body></html>`;
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(bigHtml);
    });
    const port = await listen(server);

    const started = Date.now();
    const result = await probeHttpUrl(target(port), '/', 500);

    expect(result.active).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.title).toBe('Big Page');
    // Must not fall back to the hard deadline (~2 s) or the socket timeout.
    expect(Date.now() - started).toBeLessThan(1000);
  }, 10_000);

  it('resolves active for a server that streams a response forever', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('<title>Stream</title>\n');
      const timer = setInterval(() => {
        try {
          res.write(`data: ${'x'.repeat(500)}\n\n`);
        } catch {
          clearInterval(timer);
        }
      }, 25);
      const stop = () => clearInterval(timer);
      res.on('close', stop);
      res.on('error', stop);
    });
    const port = await listen(server);

    const started = Date.now();
    const result = await probeHttpUrl(target(port), '/', 500);

    expect(result.active).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.title).toBe('Stream');
    // Settles as soon as the <title> arrives — nowhere near the ~2 s deadline.
    expect(Date.now() - started).toBeLessThan(1000);
  }, 10_000);

  it('resolves inactive when no server is listening on the port', async () => {
    // Bind then release a port so we know it is free (connection refused).
    const throwaway = createServer();
    const port = await listen(throwaway);
    await new Promise<void>((resolve) => throwaway.close(() => resolve()));
    openServers.splice(openServers.indexOf(throwaway), 1);

    const result = await probeHttpUrl(target(port), '/', 500);

    expect(result.active).toBe(false);
    expect(result.error).toBeTruthy();
  }, 10_000);
});
