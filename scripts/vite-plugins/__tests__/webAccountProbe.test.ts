/**
 * Web account probe helper behavior.
 *
 * These tests encode the Task 1 contracts before runtime integration:
 * account IDs, profile path safety, Cursor text parsing, and dependency
 * injection for browser-backed helpers.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  clearWebAccountProfile,
  getWebAccountProfileDir,
  isWebAccountProbeAgent,
  openCursorAccountLogin,
  parseCursorDashboardText,
  probeCursorAccount,
  type WebAccountProbeResult,
} from '../webAccountProbe';
import * as webAccountProbeModule from '../webAccountProbe';

describe('web account profile paths', () => {
  test('recognizes only safe Cursor probe account ids', () => {
    expect(isWebAccountProbeAgent('cursor-main')).toBe(true);
    expect(isWebAccountProbeAgent('codex')).toBe(false);
    expect(isWebAccountProbeAgent('cursor/main')).toBe(false);
    expect(isWebAccountProbeAgent('cursor main')).toBe(false);
  });

  test('accepts Cursor-style lowercase ids', () => {
    const homeDir = path.join(process.cwd(), 'tmp', 'web-account-home');
    expect(getWebAccountProfileDir('cursor-main', homeDir)).toBe(
      path.join(homeDir, '.aralia-browser-profiles', 'cursor-main'),
    );
    expect(getWebAccountProfileDir('cursor-alt', homeDir)).toBe(
      path.join(homeDir, '.aralia-browser-profiles', 'cursor-alt'),
    );
  });

  test('rejects unsafe account ids', () => {
    const homeDir = path.join(process.cwd(), 'tmp', 'web-account-home');
    expect(() => getWebAccountProfileDir('CursorMain', homeDir)).toThrow();
    expect(() => getWebAccountProfileDir('cursor/main', homeDir)).toThrow();
    expect(() => getWebAccountProfileDir('..\\cursor-main', homeDir)).toThrow();
    expect(() => getWebAccountProfileDir('cursor_main', homeDir)).toThrow();
    expect(() => getWebAccountProfileDir('cursor main', homeDir)).toThrow();
  });

  test('falls back to USERPROFILE when homeDir is missing', () => {
    const homeDir = path.join(process.cwd(), 'tmp', 'fallback-home');
    const oldUserProfile = process.env.USERPROFILE;
    process.env.USERPROFILE = homeDir;
    try {
      expect(getWebAccountProfileDir('cursor-main')).toBe(
        path.join(homeDir, '.aralia-browser-profiles', 'cursor-main'),
      );
    } finally {
      if (oldUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = oldUserProfile;
    }
  });
});

describe('Cursor dashboard text parser', () => {
  const accountId = 'cursor-main';
  const profileDir = path.join(process.cwd(), '.agent', 'tmp', 'cursor-main');

  test('returns loginRequired for sign in text', () => {
    const result = parseCursorDashboardText(accountId, 'Please sign in to continue.', profileDir, 1234);

    expect(result).toEqual<WebAccountProbeResult>({
      provider: 'cursor',
      accountId,
      profileDir,
      loginRequired: true,
      fetchedAt: 1234,
      lines: ['Please sign in to continue.'],
      usage: undefined,
      summary: undefined,
    });
  });

  test('treats Cursor browser verification as an interactive login state without storing challenge text', () => {
    const result = parseCursorDashboardText(
      accountId,
      'authenticator.cursor.sh Performing security verification __cf_chl_tk=secret Enable JavaScript and cookies to continue',
      profileDir,
      1234,
    );

    expect(result.loginRequired).toBe(true);
    expect(result.lines).toEqual(['Cursor browser verification required.']);
    expect(JSON.stringify(result)).not.toContain('__cf_chl_tk');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('parses "used of total label used" usage text', () => {
    const result = parseCursorDashboardText(
      accountId,
      '23 of 50 premium requests used this month',
      profileDir,
      1234,
    );

    expect(result).toMatchObject({
      provider: 'cursor',
      accountId,
      profileDir,
      loginRequired: false,
      fetchedAt: 1234,
      usage: {
        used: 23,
        limit: 50,
        pct: 46,
        label: 'premium requests',
      },
    });
    expect(result.summary).toBe('23 of 50 premium requests used');
    expect(result.lines).toContain('23 of 50 premium requests used this month');
  });

  test('parses percentage-only usage text', () => {
    const result = parseCursorDashboardText(accountId, '46% used', profileDir, 1234);

    expect(result).toMatchObject({
      provider: 'cursor',
      accountId,
      profileDir,
      loginRequired: false,
      fetchedAt: 1234,
      usage: {
        pct: 46,
        label: 'used',
      },
    });
  });
});

describe('probeCursorAccount with injected runners', () => {
  test('parses runner output via dependency injection', async () => {
    const homeDir = path.join(process.cwd(), 'tmp', 'runner-home');
    const result = await probeCursorAccount('cursor-main', {
      homeDir,
      fetchedAt: 2026,
      runner: async () => '46% used',
    });

    expect(result).toMatchObject({
      provider: 'cursor',
      accountId: 'cursor-main',
      profileDir: getWebAccountProfileDir('cursor-main', homeDir),
      loginRequired: false,
      fetchedAt: 2026,
      usage: { pct: 46, label: 'used' },
    });
  });

  test('propagates runner errors to callers', async () => {
    await expect(
      probeCursorAccount('cursor-main', { runner: async () => { throw new Error('profile locked'); } }),
    ).rejects.toThrow('profile locked');
  });
});

describe('openCursorAccountLogin', () => {
  test('uses injected opener and returns transparent result', async () => {
    const opener = async (profileDir: string) => {
      await fs.mkdir(profileDir, { recursive: true });
      return undefined;
    };
    const homeDir = path.join(process.cwd(), 'tmp', 'login-home');
    const result = await openCursorAccountLogin('cursor-main', { homeDir, opener });

    expect(result).toEqual({
      ok: true,
      accountId: 'cursor-main',
      profileDir: getWebAccountProfileDir('cursor-main', homeDir),
      message: 'cursor login browser started',
    });
  });

  test('returns a failure when opener throws', async () => {
    const result = await openCursorAccountLogin('cursor-main', { opener: async () => { throw new Error('boom'); } });

    expect(result.ok).toBe(false);
    expect(result.accountId).toBe('cursor-main');
    expect(result.message).toContain('boom');
  });
});

describe('clearWebAccountProfile', () => {
  const homeDir = path.join(os.tmpdir(), `aralia-web-account-home-${Date.now()}`);
  const accountProfile = getWebAccountProfileDir('cursor-main', homeDir);
  const otherProfile = getWebAccountProfileDir('cursor-alt', homeDir);

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true }).catch(() => undefined);
  });

  test('deletes only the selected profile directory', async () => {
    const targetFile = path.join(accountProfile, 'state', 'tokens.json');
    const otherFile = path.join(otherProfile, 'state', 'tokens.json');
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.mkdir(path.dirname(otherFile), { recursive: true });
    await fs.writeFile(targetFile, '{}');
    await fs.writeFile(otherFile, '{}');

    const result = await clearWebAccountProfile('cursor-main', { homeDir });

    expect(result).toEqual({
      ok: true,
      accountId: 'cursor-main',
      profileDir: accountProfile,
    });
    await expect(fs.stat(accountProfile)).rejects.toThrow();
    await expect(fs.stat(otherProfile)).resolves.toBeTruthy();
    const otherData = await fs.readFile(otherFile, 'utf8');
    expect(otherData).toBe('{}');
  });
});

describe('agent usage probe middleware', () => {
  const makeServer = () => {
    const handlers = new Map<string, (req: any, res: any) => Promise<void> | void>();
    const logger = { info: vi.fn() };
    const server = {
      middlewares: {
        use: (path: string, handler: (req: any, res: any) => Promise<void> | void) => {
          handlers.set(path, handler);
        },
      },
      config: { logger },
    };
    return { handlers, logger, server };
  };

  const makeRequest = (method: string, url: string, body?: unknown) => {
    const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    return Object.assign(stream, { method, url });
  };

  const makeResponse = () => {
    const headers: Record<string, string> = {};
    return {
      statusCode: 200,
      headers,
      body: '',
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end(chunk?: string | Buffer) {
        if (chunk) this.body += chunk.toString();
      },
    };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('lists cursor-main with the CLI agents and preserves cached entries', async () => {
    const { agentUsageProbe } = await import('../agentUsageProbe');
    const { handlers, server } = makeServer();
    agentUsageProbe().configureServer(server as any);

    const handler = handlers.get('/api/agent-usage');
    expect(handler).toBeTypeOf('function');

    const req = makeRequest('GET', '/api/agent-usage');
    const res = makeResponse();
    await handler?.(req, res);

    const payload = JSON.parse(res.body) as { agents: string[]; cache: Record<string, unknown> };
    expect(payload.agents).toContain('cursor-main');
    expect(payload.agents).toContain('cursor-alt');
    expect(payload.cache).toBeTypeOf('object');
  });

  test('refreshes cursor-main through the browser probe and keeps loginRequired visible', async () => {
    vi.spyOn(webAccountProbeModule, 'probeCursorAccount').mockResolvedValue({
      provider: 'cursor',
      accountId: 'cursor-main',
      profileDir: 'C:\\profile',
      fetchedAt: 2468,
      loginRequired: true,
      lines: ['Please sign in to continue.'],
    });

    const { agentUsageProbe } = await import('../agentUsageProbe');
    const { handlers, server } = makeServer();
    agentUsageProbe().configureServer(server as any);

    const handler = handlers.get('/api/agent-usage');
    const req = makeRequest('GET', '/api/agent-usage?agent=cursor-main&refresh=1');
    const res = makeResponse();
    await handler?.(req, res);

    const payload = JSON.parse(res.body) as {
      agent: string;
      ok: boolean;
      data: { loginRequired: boolean };
      error?: string;
    };
    expect(webAccountProbeModule.probeCursorAccount).toHaveBeenCalledWith('cursor-main');
    expect(payload.agent).toBe('cursor-main');
    expect(payload.ok).toBe(false);
    expect(payload.data.loginRequired).toBe(true);
    expect(payload.error).toBe('login required');
  });

  test('marks unparsed Cursor dashboard pages as selector missing instead of success', async () => {
    vi.spyOn(webAccountProbeModule, 'probeCursorAccount').mockResolvedValue({
      provider: 'cursor',
      accountId: 'cursor-main',
      profileDir: 'C:\\profile',
      fetchedAt: 1357,
      loginRequired: false,
      lines: ['Dashboard loaded but no quota text was recognized.'],
    });

    const { agentUsageProbe } = await import('../agentUsageProbe');
    const { handlers, server } = makeServer();
    agentUsageProbe().configureServer(server as any);

    const handler = handlers.get('/api/agent-usage');
    const req = makeRequest('GET', '/api/agent-usage?agent=cursor-main&refresh=1');
    const res = makeResponse();
    await handler?.(req, res);

    const payload = JSON.parse(res.body) as { ok: boolean; error?: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('selector missing');
  });

  test('opens and clears validated web account profiles through explicit endpoints', async () => {
    vi.spyOn(webAccountProbeModule, 'openCursorAccountLogin').mockResolvedValue({
      ok: true,
      accountId: 'cursor-main',
      profileDir: 'C:\\profile',
      message: 'cursor login browser started',
    });
    vi.spyOn(webAccountProbeModule, 'clearWebAccountProfile').mockResolvedValue({
      ok: true,
      accountId: 'cursor-main',
      profileDir: 'C:\\profile',
    });

    const { agentUsageProbe } = await import('../agentUsageProbe');
    const { handlers, server } = makeServer();
    agentUsageProbe().configureServer(server as any);

    const loginHandler = handlers.get('/api/web-account-login');
    const loginReq = makeRequest('POST', '/api/web-account-login', { accountId: 'cursor-main' });
    const loginRes = makeResponse();
    await loginHandler?.(loginReq, loginRes);
    expect(JSON.parse(loginRes.body)).toMatchObject({ ok: true, accountId: 'cursor-main' });

    const deleteHandler = handlers.get('/api/web-account-profile');
    const deleteReq = makeRequest('DELETE', '/api/web-account-profile', { accountId: 'cursor-main' });
    const deleteRes = makeResponse();
    await deleteHandler?.(deleteReq, deleteRes);
    expect(JSON.parse(deleteRes.body)).toMatchObject({ ok: true, accountId: 'cursor-main' });
  });
});
