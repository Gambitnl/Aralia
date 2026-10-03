/**
 * This file verifies how the selected-spell gate refresh decides legacy status.
 *
 * The gap (agora-a8a2): the helper used to read the `legacy` bit through an
 * untyped cast on the raw fetched spell JSON, so it answered even for a payload
 * the spell schema had just rejected. Legacy status now comes off the validated
 * schema result, which is the same source the bootstrap path already uses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bless from '@/data/spells/level-1/bless.json';
import boomingBlade from '@/data/spells/level-0/booming-blade.json';

const fetchWithTimeoutMock = vi.fn();

vi.mock('../../../../utils/context', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchWithTimeoutMock(...args),
}));

const { refreshSelectedSpellGate } = await import('../spellGateSelectedRefresh');

/** Minimal endpoint answer: the helper only reads `ok` and `gateEntry.jsonPath`. */
function gateResponse(spellId: string, jsonPath: string) {
  return {
    ok: true,
    spellId,
    gateEntry: {
      spellId,
      spellName: spellId,
      level: 1,
      jsonPath,
      schema: { valid: true, issues: [] },
    },
  };
}

/** Queue the endpoint answer first, then the spell asset the helper fetches next. */
function queueRefresh(spellId: string, jsonPath: string, spellPayload: unknown) {
  fetchWithTimeoutMock
    .mockResolvedValueOnce(gateResponse(spellId, jsonPath))
    .mockResolvedValueOnce(spellPayload);
}

describe('refreshSelectedSpellGate', () => {
  beforeEach(() => {
    fetchWithTimeoutMock.mockReset();
  });

  it('reports a schema-valid non-legacy spell as not legacy', async () => {
    queueRefresh('bless', 'public/data/spells/level-1/bless.json', bless);

    const result = await refreshSelectedSpellGate('bless');

    expect(result.schemaIssues).toEqual([]);
    expect(result.isLegacySpell).toBe(false);
    expect(result.assetPath).toBe('data/spells/level-1/bless.json');
  });

  it('reports a schema-valid legacy spell as legacy', async () => {
    queueRefresh('booming-blade', 'public/data/spells/level-0/booming-blade.json', boomingBlade);

    const result = await refreshSelectedSpellGate('booming-blade');

    expect(result.schemaIssues).toEqual([]);
    expect(result.isLegacySpell).toBe(true);
  });

  it('does not claim legacy status from a payload the spell schema rejected', async () => {
    // The old untyped probe answered `true` here, because a bare `legacy` key was
    // enough. The payload is not a spell, so the refresh reports schema issues
    // instead of a legacy verdict it cannot support.
    queueRefresh('not-a-spell', 'public/data/spells/level-1/not-a-spell.json', { legacy: true });

    const result = await refreshSelectedSpellGate('not-a-spell');

    expect(result.schemaIssues.length).toBeGreaterThan(0);
    expect(result.isLegacySpell).toBe(false);
  });

  it('fails loudly when the refresh endpoint returns no gate entry', async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce({ ok: false, spellId: 'bless', message: 'gate rebuild failed' });

    await expect(refreshSelectedSpellGate('bless')).rejects.toThrow('gate rebuild failed');
  });
});
