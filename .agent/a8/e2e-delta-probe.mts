import { getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';
import { worldReducer } from '../../src/state/reducers/worldReducer';
import {
  WORLD_DELTA_SCHEMA_VERSION,
  WORLD_DELTA_OPERATION_VERSION,
  type WorldDelta,
} from '../../src/systems/worldforge/delta/types';
import type { GameState } from '../../src/types/state';

const b = getWorldforgeLocalForLocation(42, 16, 4, 25, 16);
const delta: WorldDelta = {
  id: 'e2e-1',
  schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
  opVersion: WORLD_DELTA_OPERATION_VERSION,
  artifactSeedPath: b.local.seedPath,
  entityKey: 'plot:0',
  sequence: 1,
  operation: { kind: 'modify-plot', plotId: 0, role: 'market', storeys: 2 },
};

// Through the REAL reducer (WF-STORE-1), twice — idempotence check.
const s0 = { worldforgeDeltas: [] } as unknown as GameState;
const s1 = { ...s0, ...worldReducer(s0, { type: 'APPLY_WORLDFORGE_DELTA', payload: { delta } } as never) };
const s2 = { ...s1, ...worldReducer(s1, { type: 'APPLY_WORLDFORGE_DELTA', payload: { delta } } as never) };
console.log(`state deltas after 1st dispatch: ${s1.worldforgeDeltas.length}, after dup: ${s2.worldforgeDeltas.length}`);

const ground = makeGroundWorld(b.local, 42, b.region, { deltas: s2.worldforgeDeltas });
const plot0 = ground.buildings.find((x) => x.id.endsWith('-0'));
console.log(`village plot 0 via state-carried delta: role=${plot0?.role}, height=${plot0?.heightM}m`);
