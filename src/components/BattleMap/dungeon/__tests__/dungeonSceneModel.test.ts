/**
 * This file proves that the dungeon's 3D adapter faithfully raises the existing plan.
 *
 * The checks focus on boundaries that visual inspection cannot prove alone: every bitmap
 * floor/wall becomes one batched instance, wall caps preserve that footprint, the adapter
 * remains deterministic, prop detail can be simplified without being discarded, torch lighting
 * stays within budget, and debug recoloring never changes physical placement. Rendered browser
 * captures provide the complementary proof that those instances form a readable scene.
 *
 * Runs with: the focused Vitest command for this file and the dungeon generator suite.
 */

import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../../systems/worldforge/dungeon/generateDungeon';
import { CellKind, OverlayKind } from '../../../../systems/worldforge/dungeon/types';
import {
  buildDungeonSceneModel,
  classifyPropKind,
  decomposeProp,
  DUNGEON_3D_PALETTES,
  type DungeonSceneOptions,
} from '../dungeonSceneModel';

// ============================================================================
// Shared deterministic fixture
// ============================================================================
// A medium seed exercises history evidence, doors, props, encounters, and enough rooms to make
// graph overlays meaningful without turning this adapter test into a performance benchmark.
// ============================================================================

const PLAN = generateDungeon({
  seed: 42,
  params: { roomCount: 28, theme: 'crypt', loopChance: 0.25, decorDensity: 0.6 },
});

const BASE_OPTIONS: DungeonSceneOptions = {
  showRoomTypes: false,
  showDifficulty: false,
  showCritical: false,
};

describe('buildDungeonSceneModel', () => {
  it('raises every floor and wall cell exactly once', () => {
    const model = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const floorCells = Array.from(PLAN.grid).filter((cell) => cell === CellKind.Floor).length;
    const wallCells = Array.from(PLAN.grid).filter((cell) => cell === CellKind.Wall).length;

    // Exact counts prove the adapter neither fills playable void nor drops remote rooms.
    expect(model.floors).toHaveLength(floorCells);
    expect(model.walls).toHaveLength(wallCells);
    expect(model.wallCaps).toHaveLength(wallCells);
    expect(model.width).toBe(PLAN.W);
    expect(model.depth).toBe(PLAN.H);

    // Every pale cap belongs to one raised wall and sits just above it, so the stronger
    // silhouette cannot invent ledges or alter which cells block travel.
    expect(model.wallCaps.every((cap, index) => cap.y > model.walls[index].y)).toBe(true);

    // Camera framing uses the carved footprint rather than the often-larger generation grid.
    // Every walkable cell must fit inside that bound or an off-center theme could be clipped.
    expect(model.floors.every((floor) => (
      floor.x >= model.bounds.minX
      && floor.x <= model.bounds.maxX
      && floor.z >= model.bounds.minZ
      && floor.z <= model.bounds.maxZ
    ))).toBe(true);
    expect(model.bounds.centerX).toBe((model.bounds.minX + model.bounds.maxX) / 2);
    expect(model.bounds.centerZ).toBe((model.bounds.minZ + model.bounds.maxZ) / 2);
  });

  it('is deterministic and leaves the generator bitmap untouched', () => {
    const before = Array.from(PLAN.grid);
    const first = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const second = buildDungeonSceneModel(PLAN, BASE_OPTIONS);

    // Presentation variation uses coordinate hashes, so repeated views cannot shift gameplay.
    expect(second).toEqual(first);
    expect(Array.from(PLAN.grid)).toEqual(before);
  });

  it('surfaces history scars and respects the ten-light accent budget', () => {
    const model = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const raisedOverlays = Array.from(PLAN.overlay).filter((overlay, index) => (
      PLAN.grid[index] === CellKind.Floor
      && overlay !== OverlayKind.None
      && overlay !== OverlayKind.Rubble
    )).length;

    // Rubble is represented by evidence props; fluid/ice/bloom/scorch become shallow surfaces.
    expect(model.liquids).toHaveLength(raisedOverlays);
    expect(model.lights.length).toBeLessThanOrEqual(10);
    expect(model.lights.length).toBeLessThanOrEqual(model.flames.length);
    expect(model.markers.map((marker) => marker.label)).toEqual(['Entrance', 'Objective']);
    expect(model.markers.every((marker) => marker.radius > 0)).toBe(true);
    expect(model.spawnHalos).toHaveLength(model.spawns.length);
  });

  it('classifies tactical detail without dropping generated props', () => {
    const model = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const physicalProps = [...model.lowProps, ...model.tallProps, ...model.evidence, ...model.flames];

    // The renderer may hide minor clutter from the distant tactical preset, but every generated
    // prop remains in the shared model and returns in entrance/objective inspection views.
    expect(physicalProps).toHaveLength(PLAN.props.length);
    expect(physicalProps.some((prop) => prop.detail === true)).toBe(true);
    expect(physicalProps.some((prop) => prop.detail !== true)).toBe(true);
  });

  it('keeps semantic props in bounded primitive batches', () => {
    const model = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const semanticParts = [
      ...model.propBoxes,
      ...model.propCylinders,
      ...model.propCones,
      ...model.propSpheres,
      ...model.propOctahedrons,
      ...model.propFlames,
    ];

    // Every generated decoration contributes at least one primitive part, while the renderer
    // still needs only these six shape batches rather than one React object per source prop.
    expect(semanticParts.length).toBeGreaterThanOrEqual(PLAN.props.length);
    expect(model.propBoxes.length).toBeGreaterThan(0);
    expect(model.propFlames.length).toBeGreaterThan(0);
    expect([...model.lowProps, ...model.tallProps, ...model.evidence, ...model.flames]
      .every((prop) => prop.visualKind !== undefined)).toBe(true);
  });

  it('gives representative room-purpose props distinct composed silhouettes', () => {
    const palette = DUNGEON_3D_PALETTES.crypt;
    const sarcophagus = decomposeProp('sarcophagus', 0, 0, 0, 1, false, palette, false);
    const mushroom = decomposeProp('mushroom', 0, 0, 0, 1, false, palette, false);
    const disturbedLid = decomposeProp('disturbed-lid', 0, 0, 0, 1, true, palette, false);

    // A coffin is layered stone, a mushroom has a stem and cap, and historical damage shifts
    // its lid. These checks guard against collapsing the vocabulary back into generic boxes.
    expect(classifyPropKind('weapon-rack')).toBe('weapon-rack');
    expect(sarcophagus.map((part) => part.shape)).toEqual(['box', 'box']);
    expect(mushroom.map((part) => part.shape)).toEqual(['cylinder', 'cone']);
    expect(disturbedLid[1].instance.rotation).not.toBe(disturbedLid[0].instance.rotation);
    expect(disturbedLid[0].instance.sx).toBeGreaterThan(sarcophagus[0].instance.sx);
  });

  it('changes debug floor color without moving the physical dungeon', () => {
    const plain = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const debug = buildDungeonSceneModel(PLAN, {
      showRoomTypes: true,
      showDifficulty: true,
      showCritical: true,
    });

    // Overlay toggles are inspection tools. They may recolor floors but must not rebuild space.
    expect(debug.floors.map(({ color: _color, ...placement }) => placement))
      .toEqual(plain.floors.map(({ color: _color, ...placement }) => placement));
    expect(debug.floors.some((floor, index) => floor.color !== plain.floors[index].color)).toBe(true);
  });

  it('keeps semantic door states available to the renderer', () => {
    const model = buildDungeonSceneModel(PLAN, BASE_OPTIONS);
    const expectedStates = PLAN.doors.filter((door) => door.state !== 'open').map((door) => door.state).sort();

    // Open passages need no leaf; every physical/hidden/bricked closure remains explicit.
    expect(model.doors.map((door) => door.state).sort()).toEqual(expectedStates);
  });
});
