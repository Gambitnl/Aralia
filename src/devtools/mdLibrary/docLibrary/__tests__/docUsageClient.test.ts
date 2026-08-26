import { describe, it, expect } from 'vitest';
import { indexByPath, type DocUsage } from '../docUsageClient';

const mk = (p: string): DocUsage => ({
  path: p, consumedBy: [], consumedVia: null, duplicateGroupId: null, role: null,
  ageDays: 0, gitAgeDays: null, wordCount: 100, openTaskCount: 0, inboundLinks: 0,
  lifecycle: null, supersededBy: null, candidate: { isCandidate: false, reasons: [], confidence: 'none' },
});

describe('indexByPath', () => {
  it('keys entries by path', () => {
    const idx = indexByPath([mk('docs/a.md'), mk('docs/b.md')]);
    expect(idx['docs/a.md'].path).toBe('docs/a.md');
    expect(Object.keys(idx)).toHaveLength(2);
  });
});
