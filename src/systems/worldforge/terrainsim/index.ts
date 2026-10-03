/**
 * @file index.ts — public surface of the terrain sim.
 *
 * The terrain sim owns ground scars and scar marks for one local window and
 * advances them through in-game days. See `CONTEXT.md` for the vocabulary and
 * `docs/architecture/domains/region-terrain.md` for how it fits the terrain
 * stack.
 */
export type {
  GroundScar,
  ScarCause,
  ScarMark,
  ScarPosition,
  ScarShape,
  TerrainSimRegistry,
  TerrainSimState,
} from './types';

export { SCAR_CAUSES, healRateFor, weatheringRateFor } from './scarCauses';
export type { ScarCauseProfile } from './scarCauses';

export {
  createGroundScar,
  createScarMark,
  groundScarHeightOffsetAt,
  makeScarHeightField,
  makeScarHeightFieldForGrid,
  markFromHealedScar,
  scarDepthAt,
  scarFootprintWeight,
  scarMarkTintAt,
  scarReachM,
} from './groundScar';
export type { CreateGroundScarInput, CreateScarMarkInput } from './groundScar';

export {
  addGroundScar,
  addScarMark,
  advanceTerrainRegistry,
  advanceTerrainSim,
  createTerrainSimState,
  healedDayFor,
  pruneScarMarks,
} from './terrainSim';

export {
  METERS_PER_FOOT,
  footprintShapeForArea,
  spellTerrainFootprint,
} from './spellScarFootprint';
export type {
  SpellImpact,
  SpellImpactArea,
  SpellTerrainEffectKind,
  SpellTerrainFootprint,
} from './spellScarFootprint';
