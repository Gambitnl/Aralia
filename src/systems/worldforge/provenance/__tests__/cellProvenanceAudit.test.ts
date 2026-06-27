import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { runCellProvenanceAudit } from '../cellProvenanceAudit';

describe('runCellProvenanceAudit', () => {
  it('produces a report with no FAIL-level orphans on the golden drill path', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    const fails = report.verdicts.filter((v) => v.severity === 'fail');
    expect(fails).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('classifies the settlement and counts every ground entity', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    expect(report.cellType).toBe('settlement');
    const expected =
      1 + // terrain-biome
      path.ground.towns.length +
      path.ground.buildings.length +
      path.ground.hostiles.length +
      path.ground.features.length +
      path.ground.hiddenSites.length;
    expect(report.verdicts.length).toBe(expected);
  });

  it('emits the feature-trace schema gap as the upstream backlog', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    expect(report.schemaGaps.map((g) => g.field)).toContain('featureTraces');
  });
});
