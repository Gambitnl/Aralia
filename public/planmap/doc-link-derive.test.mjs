// ============================================================================
// Plan Map document link resolver tests
// ============================================================================
// These checks prove that local development preserves Vite /@fs access while
// static Plan Map copies link and fetch from GitHub. They guard the exact 404
// that previously made the document drawer unusable outside the dev server.
// ============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createDocLinkResolver, detectLocalDocBridge } from './doc-link-derive.mjs';

describe('createDocLinkResolver', () => {
  it('keeps checkout documents on Vite when the bridge is available', () => {
    const links = createDocLinkResolver({
      appBase: '/Aralia',
      repoRoot: 'F:/Other checkout/Aralia',
      useFsBridge: true,
    });

    expect(links.mode).toBe('vite-fs');
    expect(links.href('tools/agora/GLOSSARY.md')).toBe('/Aralia/@fs/F:/Other checkout/Aralia/tools/agora/GLOSSARY.md');
    expect(links.fetchUrl('tools/agora/GLOSSARY.md')).toBe('/Aralia/@fs/F:/Other checkout/Aralia/tools/agora/GLOSSARY.md');
  });

  it('uses GitHub source and raw URLs from a static copy', () => {
    const links = createDocLinkResolver({ appBase: '/Aralia', repoRoot: 'F:/Repos/Aralia' });

    expect(links.mode).toBe('github');
    expect(links.href('docs/design note.md')).toBe('https://github.com/Gambitnl/Aralia/blob/master/docs/design%20note.md');
    expect(links.fetchUrl('docs/design note.md')).toBe('https://raw.githubusercontent.com/Gambitnl/Aralia/master/docs/design%20note.md');
  });

  it('rejects document paths that would leave the repository', () => {
    const links = createDocLinkResolver({ useFsBridge: true, repoRoot: 'F:/Repos/Aralia' });

    expect(() => links.href('../private.txt')).toThrow('Invalid repository document path');
  });

  it.each(['../private.txt', 'docs/../../private.txt', '/private.txt', '..\\private.txt', 'docs//note.md'])('rejects raw escape/ambiguous path %s', doc => {
    expect(() => createDocLinkResolver({ useFsBridge: true, repoRoot: 'F:/Repos/Aralia' }).href(doc)).toThrow();
  });

  it('keeps encoded-looking names literal rather than interpreting them as traversal', () => {
    const links = createDocLinkResolver({ useFsBridge: true, repoRoot: 'F:/Repos/Aralia' });
    expect(links.href('%2e%2e/private.txt')).toContain('/%252e%252e/private.txt');
    expect(links.href('docs%2f..%2fprivate.txt')).toContain('/docs%252f..%252fprivate.txt');
  });
});

const clientSource = 'import "/Aralia/node_modules/vite/dist/client/env.mjs";\n// real Vite client prefix';
const planningSource = '# The Planning Stack - Truth Ownership Rules\n\nCurrent checkout guidance.';
const response = (body, mime, extra = {}) => new Response(body, { headers: { 'content-type': mime }, ...extra });
const options = { origin: 'http://localhost:3000', appBase: '/Aralia', repoRoot: 'F:/Repos/Aralia' };
const positiveFetch = () => vi.fn().mockResolvedValueOnce(response(clientSource, 'text/javascript'))
  .mockResolvedValueOnce(response(planningSource, 'text/markdown'));

describe('detectLocalDocBridge (PM-G3)', () => {
  it('requires positive Vite and checkout reads without import.meta.hot', async () => {
    const fetchImpl = positiveFetch();
    expect(await detectLocalDocBridge({ ...options, fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3000/Aralia/@vite/client',
      'http://localhost:3000/Aralia/@fs/F:/Repos/Aralia/tools/agora/PLANNING-STACK.md',
    ]);
    for (const [, config] of fetchImpl.mock.calls) {
      expect(config.redirect).toBe('error'); expect(config.cache).toBe('no-store');
      expect(config.signal).toBeInstanceOf(AbortSignal);
    }
    const links = createDocLinkResolver({ ...options, useFsBridge: true });
    expect(links.href('src/data/world/LOCATIONS.README.md')).toBe(links.fetchUrl('src/data/world/LOCATIONS.README.md'));
  });

  it('supports a changed base and POSIX checkout with spaces', async () => {
    const fetchImpl = positiveFetch();
    expect(await detectLocalDocBridge({ ...options, appBase: '/preview', repoRoot: '/srv/Aralia checkout', fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls[1][0]).toBe('http://localhost:3000/preview/@fs//srv/Aralia%20checkout/tools/agora/PLANNING-STACK.md');
  });

  it('preserves a Windows drive colon while encoding directory names for Vite', async () => {
    const fetchImpl = positiveFetch();
    expect(await detectLocalDocBridge({ ...options, repoRoot: 'F:/Other checkout/Aralia', fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls[1][0]).toBe('http://localhost:3000/Aralia/@fs/F:/Other%20checkout/Aralia/tools/agora/PLANNING-STACK.md');
  });

  it.each([
    ['HTML SPA fallback', '<html>Vite</html>', 'text/html'],
    ['HTML mislabeled as JavaScript', '<!doctype html><script>import "/vite/dist/client/env.mjs"</script>', 'text/javascript'],
    ['non-Vite JavaScript', 'export const name="static";', 'application/javascript'],
    ['wrong MIME', clientSource, 'text/plain'],
    ['empty client', '', 'text/javascript'],
  ])('keeps GitHub fallback for %s', async (_name, body, mime) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(body, mime));
    const available = await detectLocalDocBridge({ ...options, fetchImpl });
    expect(available).toBe(false); expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(createDocLinkResolver({ ...options, useFsBridge: available }).mode).toBe('github');
  });

  it.each([
    ['missing checkout', response('missing', 'text/plain', { status: 404 })],
    ['denied checkout', response('denied', 'text/plain', { status: 403 })],
    ['HTML checkout fallback', response('<html>app</html>', 'text/html')],
    ['wrong checkout text', response('# Another document', 'text/markdown')],
    ['mislabeled HTML checkout', response('<html># The Planning Stack</html>', 'text/markdown')],
  ])('does not assume the checkout from a Vite client alone: %s', async (_name, checkout) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(clientSource, 'text/javascript')).mockResolvedValueOnce(checkout);
    expect(await detectLocalDocBridge({ ...options, fetchImpl })).toBe(false);
  });

  it('refuses HTTP failures, redirects and cross-origin responses', async () => {
    for (const extra of [{ status: 404 }, { redirected: true }, { url: 'https://other.example/Aralia/@vite/client' }, { url: 'http://localhost:3000/other.js' }]) {
      const item = response(clientSource, 'text/javascript', extra.status ? extra : {});
      if (extra.redirected) Object.defineProperty(item, 'redirected', { value: true });
      if (extra.url) Object.defineProperty(item, 'url', { value: extra.url });
      const fetchImpl = vi.fn().mockResolvedValue(item);
      expect(await detectLocalDocBridge({ ...options, fetchImpl })).toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it('accepts the exact same-origin response URL and refuses an advertised oversized prefix', async () => {
    const first = response(clientSource, 'application/javascript');
    Object.defineProperty(first, 'url', { value: 'http://localhost:3000/Aralia/@vite/client' });
    expect(await detectLocalDocBridge({ ...options, fetchImpl: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(response(planningSource, 'text/plain')) })).toBe(true);
    const huge = response(clientSource, 'text/javascript'); huge.headers.set('content-length', '1000000000');
    expect(await detectLocalDocBridge({ ...options, fetchImpl: vi.fn().mockResolvedValue(huge) })).toBe(false);
  });

  it('reads a bounded prefix and cancels an oversized unadvertised body', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(20000))); }, cancel });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/javascript' } }));
    expect(await detectLocalDocBridge({ ...options, fetchImpl })).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('treats fetch/read errors as unavailable without external probes', async () => {
    expect(await detectLocalDocBridge({ ...options, fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) })).toBe(false);
    const stream = new ReadableStream({ start(controller) { controller.error(new Error('broken stream')); } });
    expect(await detectLocalDocBridge({ ...options, fetchImpl: vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/javascript' } })) })).toBe(false);
  });

  it.each([
    { origin: 'file:///' }, { origin: 'https://site.example/path' }, { appBase: '//other.example' },
    { appBase: '/a/../b' }, { appBase: '/a%2fb' }, { repoRoot: '' }, { repoRoot: 'relative/repo' },
    { repoRoot: 'F:/repo/../private' }, { repoRoot: 'F:/repo%2fprivate' }, { repoRoot: '//host/share' },
    { timeoutMs: 0 }, { timeoutMs: 10001 }, { timeoutMs: NaN },
  ])('fails closed before a request for invalid input %j', async invalid => {
    const fetchImpl = vi.fn();
    expect(await detectLocalDocBridge({ ...options, ...invalid, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // Even a fixture/server ignoring AbortSignal cannot hold page startup forever.
  it('bounds a hung fetch and a hung stream under one deadline', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(() => new Promise(() => {}));
      const pending = detectLocalDocBridge({ ...options, fetchImpl, timeoutMs: 20 });
      await vi.advanceTimersByTimeAsync(21); expect(await pending).toBe(false);
      expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
      const stream = new ReadableStream({ pull() { return new Promise(() => {}); } });
      const reading = detectLocalDocBridge({ ...options, fetchImpl: vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/javascript' } })), timeoutMs: 20 });
      await vi.advanceTimersByTimeAsync(21); expect(await reading).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});
