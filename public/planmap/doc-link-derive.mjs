// ============================================================================
// Plan Map document link resolver
// ============================================================================
// This module chooses where Plan Map document links should go. The local Vite
// server can safely read a checkout through /@fs, while a static copy has no
// access to that disk path and must use the canonical GitHub copy instead.
// index.html uses this for both ordinary links and the document side drawer;
// the focused test file keeps the two destinations from drifting apart.
// Public HTML does not always receive import.meta.hot. A bounded, read-only
// observation below selects local documents only when this same host serves
// both Vite's client and the expected checkout Markdown. Failure preserves
// the explicit static-host GitHub fallback; this is not server attestation.
// ============================================================================

const CANONICAL_REPOSITORY = 'Gambitnl/Aralia';
const CANONICAL_REF = 'master';

// ============================================================================
// Observe the current host before choosing document destinations (PM-G3)
// ============================================================================
// A successful HTTP status alone is not evidence: static SPA hosts can return
// their HTML shell for every path. Read small prefixes, refuse redirects and
// bound the whole observation, including a server that ignores cancellation.
// No script is evaluated, document is changed, or external host is probed.
export async function detectLocalDocBridge({
  appBase = '/Aralia', repoRoot = '', origin = globalThis.location?.origin,
  fetchImpl = globalThis.fetch, timeoutMs = 5000,
} = {}) {
  if (typeof appBase !== 'string' || typeof repoRoot !== 'string' || typeof origin !== 'string'
    || typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) return false;
  const base = appBase.replace(/\/+$/, '');
  const root = repoRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const cleanParts = value => value.split('/').every((part, i) => (i === 0 && part === '') || (part && part !== '.' && part !== '..'));
  if ((base && (!base.startsWith('/') || base.startsWith('//') || !cleanParts(base)))
    || /[\0\\?#%]/.test(base) || /[\0?#%]/.test(root) || root.length > 4096
    || !(/^[A-Za-z]:\//.test(root) || (root.startsWith('/') && !root.startsWith('//'))) || !cleanParts(root)) return false;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
  } catch { return false; }
  const controller = new AbortController();
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs); });

  const prefix = async (url, allowedMime) => {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'same-origin' });
    if (!response?.ok || response.redirected || (response.url && response.url !== url)) return null;
    const mime = (response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!allowedMime.includes(mime) || Number(response.headers?.get('content-length')) > 1024 * 1024) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks = []; let length = 0;
    try {
      // The byte and read limits also prevent an endless zero-byte stream from
      // starving the deadline. Only a signature is needed, never the full file.
      for (let reads = 0; reads < 32 && length < 8192; reads++) {
        const { value, done } = await reader.read();
        if (done) break;
        // Stream bytes can come from another window/test realm; a local
        // instanceof check would reject valid byte views from that realm.
        if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== 1) return null;
        const piece = value.subarray(0, 8192 - length); chunks.push(piece); length += piece.byteLength;
      }
      const bytes = new Uint8Array(length); let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
      return new TextDecoder().decode(bytes);
    } finally {
      try { await reader.cancel(); } catch { /* An aborted stream may already be closed. */ }
      reader.releaseLock();
    }
  };
  const observe = async () => {
    const clientUrl = new URL(base + '/@vite/client', origin).href;
    const client = await prefix(clientUrl, ['text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript']);
    if (client === null || /^\s*</.test(client)
      || !/^\s*import\s*['"][^'"]*(?:\/vite\/dist\/client\/env\.mjs|\/@vite\/env)['"]\s*;?/m.test(client)) return false;
    // Vite recognizes Windows drives only with their literal colon. Encode
    // directory names, but preserve that already-validated drive prefix.
    const encodedRoot = root.split('/').map((part, index) => index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)).join('/');
    const checkoutUrl = new URL(base + '/@fs/' + encodedRoot + '/tools/agora/PLANNING-STACK.md', origin).href;
    const checkout = await prefix(checkoutUrl, ['text/markdown', 'text/plain']);
    return checkout !== null && /^\s*# The Planning Stack\b/.test(checkout);
  };
  try { return await Promise.race([observe().catch(() => false), timeout]); }
  finally { clearTimeout(timer); }
}

// Keep document paths repository-relative and reject traversal before building
// either a local or remote URL. Plan Map data supplies these paths, but this
// guard means a malformed entry cannot escape the intended document root.
const repositoryPath = (value) => {
  const parts = String(value ?? '').replace(/\\/g, '/').split('/');
  if (!parts.length || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid repository document path: ${value}`);
  }
  return parts.map(encodeURIComponent).join('/');
};

// Keep the local bridge as an explicit opt-in. index.html supplies a positive
// host observation; static callers retain canonical GitHub links by default.
// This URL builder does not itself probe hosts or infer a checkout path.
export const createDocLinkResolver = ({
  appBase = '/Aralia',
  repoRoot = '',
  repository = CANONICAL_REPOSITORY,
  ref = CANONICAL_REF,
  useFsBridge = false,
} = {}) => {
  const normalizedBase = String(appBase || '/Aralia').replace(/\/+$/, '') || '/Aralia';
  const normalizedRoot = String(repoRoot || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedRepository = String(repository || CANONICAL_REPOSITORY).replace(/^\/+|\/+$/g, '');
  const normalizedRef = String(ref || CANONICAL_REF).split('/').map(encodeURIComponent).join('/');
  const mode = useFsBridge && normalizedRoot ? 'vite-fs' : 'github';

  // Use the same resolved path for every destination. Direct links should show
  // the source file in GitHub; drawer fetches need raw Markdown that the local
  // renderer can turn into readable HTML.
  const resolve = (path) => {
    const relativePath = repositoryPath(path);
    const fsUrl = `${normalizedBase}/@fs/${normalizedRoot}/${relativePath}`;
    const blobUrl = `https://github.com/${normalizedRepository}/blob/${normalizedRef}/${relativePath}`;
    const rawUrl = `https://raw.githubusercontent.com/${normalizedRepository}/${normalizedRef}/${relativePath}`;
    return { href: mode === 'vite-fs' ? fsUrl : blobUrl, fetchUrl: mode === 'vite-fs' ? fsUrl : rawUrl };
  };

  return {
    mode,
    href: (path) => resolve(path).href,
    fetchUrl: (path) => resolve(path).fetchUrl,
  };
};
