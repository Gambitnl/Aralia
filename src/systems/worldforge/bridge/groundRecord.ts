/**
 * @file groundRecord.ts - THE ONE GROUND that every edit writes into and every
 * reader takes (agora-257c, 2026-10-29, GG-533).
 *
 * WHY. Remy, 2026-10-29: "we want water to react properly to landshapes. but
 * ofcourse the game also has spells that modify the earth so there's some part
 * that needs to account for the world having a proper layer / filling where
 * water will interact with." On that day the world kept at least four copies
 * of its ground, and an edit to one never reached the others:
 *  - the drawn terrain (an 8 m lattice of the height grid);
 *  - the live river's bed (`riverWorldBed.ts`), a copy taken once at mount;
 *  - the volume ground around the player (`VolumeGroundBubble.tsx`), filled
 *    from the height grid when it builds;
 *  - the 2D battle map, the only copy a game spell changed (`TerrainCommand`).
 *
 * WHAT THE RECORD IS. The ground world's own height grid (`GroundWorld.heights`,
 * one value every 1.524 m, after generation and every carve) plus the ordered
 * list of ground edits. An edit is a `shape-ground` world delta, so it saves
 * with the player's other world changes and replays on the next build
 * (`replayGroundShapes`). A live edit (`editGround`) changes the grid in place
 * and tells every listener the box it changed, so each reader can take the new
 * ground from the grid. Nothing keeps its own private offsets.
 *
 * READERS TODAY. The live river's bed reads the fine grid inside its corridor
 * and takes each live edit (`riverWorldSite.ts`). The drawn terrain and its
 * roads draw each edited place from the fine grid (`groundShapesCutInto`,
 * `World3DScene.tsx`), for saved and live edits alike. The volume ground
 * fills from the same grid (`groundSurfaceY`), so a bubble built after an
 * edit has it; a bubble already built does not yet take a live edit (GG-533).
 *
 * WRITERS TODAY. A game spell in combat (GG-533 step 3, 2026-10-29): the
 * referee patch knows the artifact it was cut from (`groundArtifactSeedPath`,
 * stamped by `extractLocalTerrainPatch`), `spellGroundEdits.ts` turns the
 * cast into shapes, and CombatView's `useSpellGroundEdits` cuts each one into
 * the live ground (`editGround`) and saves it (`groundShapeDelta`). The
 * console and probe hook `window.__wf3dGround` cuts the same way.
 */
import { heightToMeters, metersToHeight } from '@/systems/world3d/config';
import { WORLD_DELTA_OPERATION_VERSION, WORLD_DELTA_SCHEMA_VERSION, type WorldDelta } from '../delta/types';
import {
  groundShapeBounds,
  groundShapeDeltas,
  validateGroundShape,
  type GroundShape,
  type GroundShapeBounds,
} from '../terrain/groundShapeProfile';
import { GROUND_METERS_PER_CELL } from './groundWorldAdapter';

/** The part of a ground world the record works on: its height grid, encoded 0..100 per cell. */
export interface GroundHeightGrid {
  cols: number;
  rows: number;
  heights: number[];
  /**
   * The local artifact the grid was built for, carried as data. The game
   * builds its ground world in a Web Worker and the main thread gets a copy,
   * so the record's maps below (keyed by the worker's array) cannot answer
   * for it; these fields cross the copy (2026-10-29, GG-533).
   */
  artifactSeedPath?: string;
  /** The saved shapes replayed onto the grid at build, oldest first, carried as data for the same reason. */
  groundShapes?: readonly GroundShape[];
}

/** The entity key every ground-shape delta carries: one entity, so `sequence` alone orders the edits. */
export const GROUND_SHAPE_ENTITY = 'ground:shape';

/**
 * Cut one shape into the height grid, in place. The grid's vertex (c, r)
 * stands at world (c, r) times GROUND_METERS_PER_CELL, the same points
 * `groundSurfaceY` reads. Returns the box the shape could change (ground
 * meters), or null when it changed nothing.
 */
export function applyGroundShape(ground: GroundHeightGrid, shape: GroundShape): GroundShapeBounds | null {
  validateGroundShape(shape);
  const { cols, rows, heights } = ground;
  const deltas = groundShapeDeltas(shape, {
    nx: cols, nz: rows, step: GROUND_METERS_PER_CELL, x0: 0, z0: 0,
    read: (index) => heightToMeters(heights[index]),
  });
  if (deltas.length === 0) return null;
  // The deltas were all read before any write: a wall's crest and every
  // target come from the ground as it stood before this shape.
  for (const [index, delta] of deltas) heights[index] = metersToHeight(heightToMeters(heights[index]) + delta);
  shapeListOf(ground).push(shape);
  return groundShapeBounds(shape);
}

/**
 * Every shape cut into one height grid, saved edits replayed at build and live
 * edits alike, oldest first. Keyed by the grid's own `heights` array, which the
 * ground world shares (`GroundWorld.heights`), so the drawn terrain can ask
 * which places hold an edit and draw them from the fine grid (GG-533).
 */
const shapesCut = new WeakMap<number[], GroundShape[]>();

/**
 * The local artifact each height grid belongs to, set when its saved edits
 * replay at build (`replayGroundShapes` runs for every built ground, with or
 * without edits). Keyed by the grid's `heights` array, as `shapesCut` is.
 */
const artifactOf = new WeakMap<number[], string>();

/**
 * The local artifact seed path this grid was built for, if it is known: from
 * the build on this thread, else from the grid's own `artifactSeedPath` (a
 * ground world copied out of the world-gen worker).
 */
export function groundArtifactSeedPath(ground: GroundHeightGrid): string | undefined {
  return artifactOf.get(ground.heights) ?? ground.artifactSeedPath;
}

/**
 * The shape list of one grid: the one this thread keeps, or a new one that
 * starts from the grid's own saved `groundShapes` (a worker copy), so a live
 * edit on a copy lands after the saved edits instead of hiding them.
 */
function shapeListOf(ground: GroundHeightGrid): GroundShape[] {
  let list = shapesCut.get(ground.heights);
  if (!list) {
    list = [...(ground.groundShapes ?? [])];
    shapesCut.set(ground.heights, list);
  }
  return list;
}

/** The shapes cut into this grid so far, saved and live, oldest first (empty for none). */
export function groundShapesCutInto(ground: GroundHeightGrid): readonly GroundShape[] {
  return shapesCut.get(ground.heights) ?? ground.groundShapes ?? [];
}

/**
 * Replay the saved ground-shape edits of one artifact onto a freshly built
 * height grid, in their recorded order. Returns how many were applied.
 */
export function replayGroundShapes(ground: GroundHeightGrid, deltas: readonly WorldDelta[], artifactSeedPath: string): number {
  artifactOf.set(ground.heights, artifactSeedPath);
  const shapes = deltas
    .filter((d) => d.operation.kind === 'shape-ground' && d.artifactSeedPath === artifactSeedPath)
    .sort((a, b) => (a.sequence - b.sequence) || a.id.localeCompare(b.id));
  let applied = 0;
  for (const d of shapes) {
    if (d.operation.kind !== 'shape-ground') continue;
    try {
      applyGroundShape(ground, d.operation.shape);
      applied += 1;
    } catch (e) {
      // A saved shape this build cannot cut (an invalid record) is skipped
      // and named, never dropped silently.
      console.warn(`[ground] Skipped ground-shape delta ${d.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return applied;
}

/** What a listener hears after a live edit. */
export interface GroundEditEvent {
  ground: GroundHeightGrid;
  shape: GroundShape;
  /** The box the edit could change, ground meters. */
  box: GroundShapeBounds;
  /** The edit's place in this session's order (1, 2, ...). */
  sequence: number;
}

const listeners = new Set<(e: GroundEditEvent) => void>();
let sequence = 0;
/** This session's live edits, in order (the caller saves them as deltas; see GROUND_SHAPE_ENTITY). */
const sessionEdits: GroundEditEvent[] = [];

/**
 * THE LIVE EDIT: cut a shape into the ground now and tell every reader. Every
 * spell or tool that changes the land in the 3D world calls this, and nothing
 * else changes the ground's shape. Returns the event, or null when the shape
 * changed nothing.
 */
export function editGround(ground: GroundHeightGrid, shape: GroundShape): GroundEditEvent | null {
  const box = applyGroundShape(ground, shape);
  if (!box) return null;
  sequence += 1;
  const event: GroundEditEvent = { ground, shape, box, sequence };
  sessionEdits.push(event);
  for (const l of listeners) {
    try {
      l(event);
    } catch (e) {
      // One reader's fault must not stop the others from seeing the edit.
      console.error('[ground] A ground-edit listener failed:', e);
    }
  }
  return event;
}

/** Listen for live ground edits. Returns the unsubscribe call. */
export function onGroundEdit(listener: (e: GroundEditEvent) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** This session's live edits so far, oldest first. */
export function groundEditsThisSession(): readonly GroundEditEvent[] {
  return sessionEdits;
}

/**
 * The sequence a new ground edit of this artifact takes: one past the highest
 * saved one, so it replays after every earlier edit (1 when there is none).
 */
export function nextGroundShapeSequence(deltas: readonly WorldDelta[], artifactSeedPath: string): number {
  let max = 0;
  for (const d of deltas) {
    if (d.operation.kind === 'shape-ground' && d.artifactSeedPath === artifactSeedPath && d.sequence > max) max = d.sequence;
  }
  return max + 1;
}

/**
 * The world delta that saves one live edit (the caller appends it to the
 * save's world deltas). `sequence` orders it after every earlier ground edit
 * of the artifact (`nextGroundShapeSequence`). The id carries the artifact
 * and the sequence: the save's reducer drops a delta whose id it holds, and
 * the first id form (`ground-shape-<n>`) took n from a counter that restarts
 * each session, so a second session's first edit would have been dropped.
 */
export function groundShapeDelta(artifactSeedPath: string, shape: GroundShape, deltaSequence: number): WorldDelta {
  return {
    id: `ground-shape:${artifactSeedPath}:${deltaSequence}`,
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath,
    entityKey: GROUND_SHAPE_ENTITY,
    sequence: deltaSequence,
    operation: { kind: 'shape-ground', shape },
  };
}
