/**
 * @file acceptedEntities.test.ts — the approved creature library as a runtime
 * source. Only entries a human approved in the review library may reach the
 * game; 'generated' drafts must never leak. Tests drive the module through
 * its test seam and its pure module-map mapper so no suite depends on the
 * real JSON files on disk.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  entriesFromModules,
  approvedEntries,
  acceptedById,
  acceptedByName,
  recipeForAccepted,
  __setEntriesForTests,
  type AcceptedEntity,
} from '../library/acceptedEntities';
import type { CreaturePlan } from '../textPlan/planSchema';

/** Minimal valid plan (shape copied from textPlan/fixtures.ts floatingEye). */
const makePlan = (name: string): CreaturePlan => ({
  name,
  frame: { heightFt: 3.5, bulk: 0.95, stance: 'floating' },
  spine: { segments: 2, taper: 0.9, arch: 0 },
  appendages: [],
  heads: [{ sizeScale: 1.6, eyes: { count: 1, sizeScale: 2 } }],
  palette: { bodyHex: '#6b5b8f', accentHex: '#a08cc4', eyeHex: '#7fd4c1' },
});

/** A raw library-entry file body, as the plans/*.json writer stores it. */
const fileEntry = (id: string, name: string, status: 'generated' | 'approved', extra?: Record<string, unknown>) => ({
  id,
  name,
  slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${id}`,
  description: `test entry ${name}`,
  plan: makePlan(name),
  status,
  createdAt: '2026-07-22T00:00:00.000Z',
  ...extra,
});

const seedEntry = (id: string, name: string, extra?: Partial<AcceptedEntity>): AcceptedEntity => ({
  id,
  name,
  plan: makePlan(name),
  ...extra,
});

afterEach(() => __setEntriesForTests(null));

describe('entriesFromModules', () => {
  it('keeps only approved entries — generated drafts never reach the game', () => {
    const out = entriesFromModules({
      '/src/data/creatures3d/plans/a.json': { default: fileEntry('a1', 'Alpha', 'approved') },
      '/src/data/creatures3d/plans/b.json': { default: fileEntry('b1', 'Beta', 'generated') },
      '/src/data/creatures3d/plans/c.json': { default: fileEntry('c1', 'Gamma', 'approved') },
    });
    expect(out.map((e) => e.id).sort()).toEqual(['a1', 'c1']);
  });

  it('unwraps both module shapes: { default } wrapper and the bare object', () => {
    const out = entriesFromModules({
      '/plans/wrapped.json': { default: fileEntry('w1', 'Wrapped', 'approved') },
      '/plans/bare.json': fileEntry('b2', 'Bare', 'approved'),
    });
    expect(out.map((e) => e.id).sort()).toEqual(['b2', 'w1']);
  });

  it('maps id, name, plan, and the optional sizeCategory/heroGlb through', () => {
    const out = entriesFromModules({
      '/plans/full.json': {
        default: fileEntry('f1', 'Full Beast', 'approved', { sizeCategory: 'Huge', heroGlb: 'full-beast.glb' }),
      },
      '/plans/lean.json': { default: fileEntry('l1', 'Lean Beast', 'approved') },
    });
    const full = out.find((e) => e.id === 'f1');
    expect(full).toEqual({
      id: 'f1',
      name: 'Full Beast',
      plan: makePlan('Full Beast'),
      sizeCategory: 'Huge',
      heroGlb: 'full-beast.glb',
    });
    const lean = out.find((e) => e.id === 'l1');
    expect(lean).toEqual({ id: 'l1', name: 'Lean Beast', plan: makePlan('Lean Beast') });
  });

  it('skips malformed modules without throwing', () => {
    const out = entriesFromModules({
      '/plans/junk.json': { default: { hello: 'world' } },
      '/plans/null.json': null,
      '/plans/ok.json': { default: fileEntry('ok1', 'Fine', 'approved') },
    });
    expect(out.map((e) => e.id)).toEqual(['ok1']);
  });
});

describe('approvedEntries + test seam', () => {
  it('returns the seeded entries while the seam is set, and drops them when restored', () => {
    __setEntriesForTests([seedEntry('t1', 'Seam Test Creature')]);
    expect(approvedEntries().map((e) => e.id)).toEqual(['t1']);
    __setEntriesForTests(null);
    // Back on the production glob: the synthetic entry is gone.
    expect(approvedEntries().find((e) => e.id === 't1')).toBeUndefined();
  });
});

describe('acceptedById', () => {
  it('finds an entry by id and returns null for unknown ids', () => {
    __setEntriesForTests([seedEntry('id-a', 'Creature A'), seedEntry('id-b', 'Creature B')]);
    expect(acceptedById('id-b')?.name).toBe('Creature B');
    expect(acceptedById('id-missing')).toBeNull();
  });
});

describe('acceptedByName', () => {
  it('matches exactly, ignoring case and surrounding whitespace', () => {
    __setEntriesForTests([seedEntry('n1', 'Basalt Ember Beetle')]);
    expect(acceptedByName('Basalt Ember Beetle')?.id).toBe('n1');
    expect(acceptedByName('  basalt ember beetle  ')?.id).toBe('n1');
    expect(acceptedByName('BASALT EMBER BEETLE')?.id).toBe('n1');
  });

  it('returns null for names with no approved entry — partial matches do not count', () => {
    __setEntriesForTests([seedEntry('n2', 'Basalt Ember Beetle')]);
    expect(acceptedByName('Basalt Ember')).toBeNull();
    expect(acceptedByName('Dire Wolf')).toBeNull();
  });
});

describe('recipeForAccepted', () => {
  it('builds a planned recipe carrying the stored plan, seeded by the entry id', () => {
    const entry = seedEntry('r1', 'Recipe Beast');
    const recipe = recipeForAccepted(entry);
    expect(recipe).toEqual({ kind: 'planned', plan: entry.plan, seed: 'r1' });
  });
});
