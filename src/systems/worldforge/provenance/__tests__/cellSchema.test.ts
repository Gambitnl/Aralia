import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell } from '../worldCell';
import { auditCellSchema } from '../cellSchema';

describe('auditCellSchema', () => {
  it('reports no gaps for facts the cell already owns (biome, height, population)', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const burg = path.pack.burgs?.[path.burgId];
    const gaps = auditCellSchema(facts, burg);
    const fields = gaps.map((g) => g.field);
    expect(fields).not.toContain('biomeId');
    expect(fields).not.toContain('height');
    expect(fields).not.toContain('population');
  });

  it('reports feature-trace facts the worldmap cell does not yet own', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const burg = path.pack.burgs?.[path.burgId];
    const gaps = auditCellSchema(facts, burg);
    const fields = gaps.map((g) => g.field);
    expect(fields).toContain('featureTraces');
  });
});
