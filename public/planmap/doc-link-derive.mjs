// ============================================================================
// Plan Map document link resolver
// ============================================================================
// This module chooses where Plan Map document links should go. The local Vite
// server can safely read a checkout through /@fs, while a static copy has no
// access to that disk path and must use the canonical GitHub copy instead.
// index.html uses this for both ordinary links and the document side drawer;
// the focused test file keeps the two destinations from drifting apart.
// ============================================================================

const CANONICAL_REPOSITORY = 'Gambitnl/Aralia';
const CANONICAL_REF = 'master';

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

// A browser cannot discover the developer's checkout from a static host. Keep
// the local bridge as an explicit opt-in so static pages consistently link to
// the reviewed canonical repository rather than emitting a broken /@fs URL.
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
