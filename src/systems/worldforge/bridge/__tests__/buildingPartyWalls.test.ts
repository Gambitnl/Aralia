/**
 * These tests pin the shared visible-party-wall rule independently of any one
 * dressing projector. Structural walls remain complete; only the frontage
 * neighbor selected by the ensemble receipt may present the shared exterior.
 */

import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../interior/generateBuilding';
import { rootSeedPath } from '../../seedPath';
import {
  isNonOwnerPartyWallRun,
  isVisibleExteriorRun,
} from '../buildingPartyWalls';

// ============================================================================
// Canonical Row Fixture
// ============================================================================

function rowBlueprint(owner: 'earlier-frontage-member' | 'later-frontage-member') {
  return generateBuilding({
    buildingId: 314,
    type: 'townhouse',
    seedPath: rootSeedPath(314),
    storeys: 2,
    basement: false,
    ensemble: {
      blockKey: 'ward:1:edge:3',
      kind: 'row',
      partyWallLeft: true,
      partyWallRight: true,
      partyWallOwner: owner,
      eaveStoreys: 2,
      ensembleSignature: 'row-wall-dressing-owner-proof',
    },
  });
}

// ============================================================================
// Ownership Contract
// ============================================================================

describe('party-wall exterior ownership', () => {
  it('hides only the left seam when the earlier frontage member owns masonry', () => {
    const blueprint = rowBlueprint('earlier-frontage-member');
    const runs = blueprint.floors[0].wallRuns.filter((run) => run.kind === 'outer');

    expect(runs.some((run) => run.nx === -1 && isNonOwnerPartyWallRun(blueprint, run))).toBe(true);
    expect(runs.filter((run) => run.nx === 1).every((run) => isVisibleExteriorRun(blueprint, run))).toBe(true);
    expect(runs.filter((run) => run.ny !== 0).every((run) => isVisibleExteriorRun(blueprint, run))).toBe(true);
  });

  it('hides only the right seam when the later frontage member owns masonry', () => {
    const blueprint = rowBlueprint('later-frontage-member');
    const runs = blueprint.floors[0].wallRuns.filter((run) => run.kind === 'outer');

    expect(runs.some((run) => run.nx === 1 && isNonOwnerPartyWallRun(blueprint, run))).toBe(true);
    expect(runs.filter((run) => run.nx === -1).every((run) => isVisibleExteriorRun(blueprint, run))).toBe(true);
    expect(runs.filter((run) => run.ny !== 0).every((run) => isVisibleExteriorRun(blueprint, run))).toBe(true);
  });

  it('keeps every outer run visible for legacy receipts without an owner', () => {
    const blueprint = rowBlueprint('earlier-frontage-member');
    delete blueprint.ensemble!.partyWallOwner;
    const runs = blueprint.floors[0].wallRuns.filter((run) => run.kind === 'outer');

    expect(runs.every((run) => isVisibleExteriorRun(blueprint, run))).toBe(true);
    expect(runs.every((run) => !isNonOwnerPartyWallRun(blueprint, run))).toBe(true);
  });
});
