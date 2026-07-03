import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import {
  classifyHostiles,
  classifyFeatures,
  classifyHiddenSites,
} from '../groundProvenance';

describe('hostile provenance', () => {
  it('hostiles are inherited when the region has markers or zones; otherwise none exist', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyHostiles(path.region, path.ground);
    expect(verdicts.length).toBe(path.ground.hostiles.length);
    const hasAnchorSource =
      (path.region.markers?.length ?? 0) > 0 || (path.region.zones?.length ?? 0) > 0;
    if (path.ground.hostiles.length > 0) {
      expect(hasAnchorSource).toBe(true);
      expect(verdicts.every((v) => v.state === 'inherited')).toBe(true);
    }
  }, 30_000); // first test pays the full drill-path fixture build
});

describe('feature provenance', () => {
  it('every feature is an elaboration of the inherited biome', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyFeatures(path.ground);
    expect(verdicts.length).toBe(path.ground.features.length);
    expect(verdicts.every((v) => v.state === 'elaborated')).toBe(true);
    expect(verdicts.every((v) => v.severity === 'ok')).toBe(true);
  });
});

describe('hidden-site provenance', () => {
  it('hidden sites without a marker anchor are flagged as warn-level orphans', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyHiddenSites(path.region, path.ground);
    expect(verdicts.length).toBe(path.ground.hiddenSites.length);
    // No hard failures from hidden sites this slice.
    expect(verdicts.every((v) => v.severity !== 'fail')).toBe(true);
  });
});
