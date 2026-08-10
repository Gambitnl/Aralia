/**
 * @file terrain/index.ts
 * Barrel export for the 3D terrain system components.
 */
export { default as TerrainMesh } from './TerrainMesh';
export { makeTerrainHeightSampler } from './TerrainMesh';
export { default as GridOverlay } from './GridOverlay';
export { default as GrassLayer } from './GrassLayer';
export { default as WaterSystem } from './WaterSystem';
export { default as FordStones } from './FordStones';
export { default as DecorationProps } from './DecorationProps';
export { default as GroundScatter } from './GroundScatter';
export { default as EzTreeLayer } from './EzTreeLayer';
/* The ground from the edge of the board to the horizon. One mesh, one draw
 * call, the same height function the heightfield's fringe is built from. */
export { default as TerrainApron, buildApronGeometry } from './TerrainApron';
export {
  apronReachTiles,
  makeApronField,
  resolveApronProfile,
  resolveHorizon,
  FRINGE_TILES,
  APRON_PROFILES,
  type ApronField,
  type ApronProfile,
  type HorizonSetup,
} from './apronField';
export { default as GroundMist } from './GroundMist';
/* The volume arena: the ground as matter, and the water that rests on it. */
export {
  default as VolumeArenaGround,
  ARENA_HEIGHTFIELD_INSET_TILES,
  type ArenaSurface,
} from './VolumeArenaGround';
export { default as VolumeArenaWater } from './VolumeArenaWater';
