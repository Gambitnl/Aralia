import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell, classifyCellType } from '../worldCell';

describe('readWorldCell', () => {
  it('reads canonical facts for the golden settlement cell', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    expect(facts.id).toBe(path.cellId);
    expect(facts.burgId).toBe(path.burgId);
    expect(facts.height).toBeGreaterThanOrEqual(0);
    expect(facts.biomeId).toBeGreaterThanOrEqual(0);
  }, 30_000); // first test pays the full drill-path fixture build

  it('classifies a burg-bearing cell as a settlement', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    expect(classifyCellType(facts)).toBe('settlement');
  });
});
