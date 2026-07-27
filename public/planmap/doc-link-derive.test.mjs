// ============================================================================
// Plan Map document link resolver tests
// ============================================================================
// These checks prove that local development preserves Vite /@fs access while
// static Plan Map copies link and fetch from GitHub. They guard the exact 404
// that previously made the document drawer unusable outside the dev server.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { createDocLinkResolver } from './doc-link-derive.mjs';

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
});
