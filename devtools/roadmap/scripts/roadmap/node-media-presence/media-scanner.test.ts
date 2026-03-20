import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';

const { readdirSyncMock } = vi.hoisted(() => ({ readdirSyncMock: vi.fn() }));
vi.mock('fs', () => ({
  default: { readdirSync: readdirSyncMock, existsSync: vi.fn() },
  readdirSync: readdirSyncMock,
  existsSync: vi.fn()
}));

import { buildMediaSet, hasMediaFile } from './media-scanner';

describe('buildMediaSet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty set when directory does not exist', () => {
    readdirSyncMock.mockImplementation(() => { throw new Error('ENOENT'); });
    expect(buildMediaSet('/some/path')).toEqual(new Set());
  });

  it('returns stems of image files only', () => {
    readdirSyncMock.mockReturnValue(['spell-axis-engine.png', 'vsm-drill.gif', 'readme.md', '.gitkeep']);
    const result = buildMediaSet('/media');
    expect(result).toEqual(new Set(['spell-axis-engine', 'vsm-drill']));
  });

  it('ignores files without recognised image extensions', () => {
    readdirSyncMock.mockReturnValue(['node.ts', 'node.json']);
    expect(buildMediaSet('/media')).toEqual(new Set());
  });
});

describe('hasMediaFile', () => {
  it('returns true when node id is in the set', () => {
    const set = new Set(['my-node-id']);
    expect(hasMediaFile('my-node-id', set)).toBe(true);
  });

  it('returns false when node id is not in the set', () => {
    expect(hasMediaFile('missing-node', new Set())).toBe(false);
  });
});
