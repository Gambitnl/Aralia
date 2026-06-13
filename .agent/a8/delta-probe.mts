import { getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';
import {
  WORLD_DELTA_SCHEMA_VERSION,
  WORLD_DELTA_OPERATION_VERSION,
  type WorldDelta,
} from '../../src/systems/worldforge/delta/types';

const b = getWorldforgeLocalForLocation(42, 16, 4, 25, 16);
const base = makeGroundWorld(b.local, 42, b.region);
const houses = base.buildings.filter((x) => x.role === 'house');
const targetId = Number(houses[0].id.split('-').pop());

const deltas: WorldDelta[] = [
  {
    id: 'probe-1',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: b.local.seedPath,
    entityKey: `plot:${targetId}`,
    sequence: 1,
    operation: { kind: 'modify-plot', plotId: targetId, role: 'market', storeys: 2 },
  },
];

const edited = makeGroundWorld(b.local, 42, b.region, { deltas });
const before = base.buildings.find((x) => x.id.endsWith(`-${targetId}`));
const after = edited.buildings.find((x) => x.id.endsWith(`-${targetId}`));
console.log(`plot ${targetId}: before role=${before?.role} h=${before?.heightM}m, after role=${after?.role} h=${after?.heightM}m`);
console.log(`markets: ${base.buildings.filter((x) => x.role === 'market').length} -> ${edited.buildings.filter((x) => x.role === 'market').length}`);
const det = JSON.stringify(makeGroundWorld(b.local, 42, b.region, { deltas }).buildings) === JSON.stringify(edited.buildings);
console.log(`deterministic replay: ${det}`);
