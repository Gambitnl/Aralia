/** Pure tests for row-level terrain terrace negotiation. */
import { describe, expect, it } from 'vitest';
import {
  resolveTerrainTerraces,
  TERRACE_STEP_ENCODED,
} from '../terrainTerraces';

const row = (id: string, rawHeightEncoded: number, order: number) => ({
  id,
  rawHeightEncoded,
  order,
  blockKey: 'ward:2:edge:1',
  ensembleKind: 'row' as const,
});

describe('resolveTerrainTerraces', () => {
  it('snaps a viable frontage to storey steps with bounded neighbor changes', () => {
    const resolved = resolveTerrainTerraces([
      row('a', 40, 0),
      row('b', 40.08, 1),
      row('c', 40.22, 2),
      row('d', 40.42, 3),
    ]);
    const receipts = ['a', 'b', 'c', 'd'].map((id) => resolved.get(id)!.terrace!);

    expect(receipts.map(({ stepIndex }) => stepIndex)).toEqual([0, 0, 1, 2]);
    expect(receipts.map(({ padHeightEncoded }) => padHeightEncoded)).toEqual([
      40,
      40,
      40 + TERRACE_STEP_ENCODED,
      40 + TERRACE_STEP_ENCODED * 2,
    ]);
    for (let index = 1; index < receipts.length; index++) {
      expect(Math.abs(receipts[index].stepIndex - receipts[index - 1].stepIndex))
        .toBeLessThanOrEqual(1);
    }
  });

  it('rejects an overly steep group transactionally', () => {
    const candidates = [row('a', 40, 0), row('b', 40 + TERRACE_STEP_ENCODED * 3, 1)];
    const resolved = resolveTerrainTerraces(candidates);

    for (const candidate of candidates) {
      expect(resolved.get(candidate.id)).toEqual({
        padHeightEncoded: candidate.rawHeightEncoded,
      });
    }
  });

  it('leaves detached, courtyard, and singleton rows on their exact samples', () => {
    const resolved = resolveTerrainTerraces([
      { ...row('detached', 12.3, 0), ensembleKind: 'detached' as const },
      { ...row('court', 14.7, 1), ensembleKind: 'courtyard' as const },
      { ...row('single', 19.1, 2), blockKey: 'single-row' },
    ]);

    expect([...resolved.values()]).toEqual([
      { padHeightEncoded: 12.3 },
      { padHeightEncoded: 14.7 },
      { padHeightEncoded: 19.1 },
    ]);
  });

  it('replays terrace datums and signatures exactly', () => {
    const candidates = [row('a', 51.2, 0), row('b', 51.3, 1)];
    expect(resolveTerrainTerraces(candidates)).toEqual(resolveTerrainTerraces(candidates));
    expect(resolveTerrainTerraces(candidates).get('a')?.terrace?.terraceSignature)
      .toBeTruthy();
  });
});
