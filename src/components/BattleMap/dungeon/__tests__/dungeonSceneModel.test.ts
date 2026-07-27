/**
 * This file proves that the dungeon's 3D adapter faithfully raises the existing plan.
 *
 * The checks focus on boundaries that visual inspection cannot prove alone: every bitmap
 * floor/wall becomes one batched instance, wall caps preserve that footprint, the adapter
 * remains deterministic, prop detail can be simplified without being discarded, torch lighting
 * stays within budget, planned arches and theme forms remain deterministic, and debug recoloring
 * never changes physical placement. Rendered browser captures provide the complementary proof that
 * those instances form a readable scene.
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
  roomPurposeReadability,
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

const THEME_PLANS = {
  crypt: PLAN,
  cavern: generateDungeon({
    seed: 42,
    params: { roomCount: 28, theme: 'cavern', loopChance: 0.25, decorDensity: 0.6 },
  }),
  frost: generateDungeon({
    seed: 42,
    params: { roomCount: 28, theme: 'frost', loopChance: 0.25, decorDensity: 0.6 },
  }),
};

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

  it('plans one curved arch per authored doorway without changing route data', () => {
    for (const plan of Object.values(THEME_PLANS)) {
      const before = {
        grid: Array.from(plan.grid),
        bfs: Array.from(plan.bfs),
        corridorCells: plan.corridorCells.map((cell) => ({ ...cell })),
        doors: plan.doors.map((door) => ({ ...door, cell: { ...door.cell } })),
      };
      const model = buildDungeonSceneModel(plan, BASE_OPTIONS);

      // Door cells are the existing DungeonPlan authority. Each receives one visible head and two
      // side piers, while the plan's walkability, distance field, and routes remain byte-stable.
      expect(model.arches).toHaveLength(plan.doors.length);
      expect(model.architectureBoxes).toHaveLength(plan.doors.length * 2);
      expect(model.arches.every((arch) => arch.y > 0 && arch.sy > 2)).toBe(true);
      expect(Array.from(plan.grid)).toEqual(before.grid);
      expect(Array.from(plan.bfs)).toEqual(before.bfs);
      expect(plan.corridorCells).toEqual(before.corridorCells);
      expect(plan.doors).toEqual(before.doors);
    }
  });

  it('gives crypt, cavern, and frost distinct deterministic structural form', () => {
    const crypt = buildDungeonSceneModel(THEME_PLANS.crypt, BASE_OPTIONS);
    const cavern = buildDungeonSceneModel(THEME_PLANS.cavern, BASE_OPTIONS);
    const frost = buildDungeonSceneModel(THEME_PLANS.frost, BASE_OPTIONS);

    // These arrays are permanent architecture, not room-purpose dressing: round crypt supports,
    // overlapping cavern rock curves, and tall frost fins each use their own instanced vocabulary.
    expect(crypt.architectureCylinders.length).toBeGreaterThan(0);
    expect(crypt.architectureSpheres).toHaveLength(0);
    expect(cavern.architectureSpheres.length).toBeGreaterThan(0);
    expect(cavern.architectureCones).toHaveLength(0);
    expect(frost.architectureCones.length).toBeGreaterThan(0);
    expect(frost.architectureOctahedrons).toHaveLength(THEME_PLANS.frost.doors.length);

    // At least one diagonal/chamfered boundary must survive into visible wall rotation for every
    // representative form; otherwise ellipse and diamond plans regress to axis-aligned teeth.
    for (const model of [crypt, cavern, frost]) {
      expect(model.walls.some((wall) => Math.abs(wall.rotation) > 0.01)).toBe(true);
      expect(model.walls.every((wall) => Number.isFinite(wall.rotation))).toBe(true);
    }

    // Rebuilding a theme repeats every architecture placement and material exactly.
    expect(buildDungeonSceneModel(THEME_PLANS.cavern, BASE_OPTIONS)).toEqual(cavern);
    expect(buildDungeonSceneModel(THEME_PLANS.frost, BASE_OPTIONS)).toEqual(frost);
  });

  it('maps declared room purposes to distinct physical landmark families', () => {
    // The mapping is deliberately read from the existing RoomPurpose vocabulary. These
    // representative jobs cover thresholds, worship, burial, valuables, work, habitation,
    // service, and water without creating a second role field in the generated plan.
    expect(roomPurposeReadability('stair').landmark).toBe('threshold-steps');
    expect(roomPurposeReadability('chapel').landmark).toBe('ritual-dais');
    expect(roomPurposeReadability('burial-gallery').landmark).toBe('burial-bays');
    expect(roomPurposeReadability('treasury').landmark).toBe('secure-store');
    expect(roomPurposeReadability('hoist').landmark).toBe('work-gantry');
    expect(roomPurposeReadability('great-hall').landmark).toBe('occupied-hall');
    expect(roomPurposeReadability('kitchen').landmark).toBe('service-bench');
    expect(roomPurposeReadability('cistern').landmark).toBe('water-basin');

    // Generic circulation has no invented claim about gameplay or former use.
    expect(roomPurposeReadability('passage-room').landmark).toBeNull();
    expect(roomPurposeReadability('maintenance-walk').landmark).toBeNull();
  });

  it('adds deterministic purpose landmarks without changing routes or collision', () => {
    for (const plan of Object.values(THEME_PLANS)) {
      const before = {
        grid: Array.from(plan.grid),
        bfs: Array.from(plan.bfs),
        corridor: Array.from(plan.corridor),
        corridorCells: plan.corridorCells.map((cell) => ({ ...cell })),
        criticalRoomIds: [...plan.criticalRoomIds],
        doors: plan.doors.map((door) => ({ ...door, cell: { ...door.cell } })),
      };
      const first = buildDungeonSceneModel(plan, BASE_OPTIONS);
      const second = buildDungeonSceneModel(plan, BASE_OPTIONS);
      const landmarkParts = [
        ...first.propBoxes,
        ...first.propCylinders,
        ...first.propCones,
        ...first.propSpheres,
        ...first.propOctahedrons,
      ].filter((part) => part.purposeLandmark === true);
      const expectedPurposeRoomIds = plan.rooms
        .filter((room) => roomPurposeReadability(room.purpose).landmark !== null)
        .map((room) => room.id)
        .sort((left, right) => left - right);
      const representedRoomIds = [...new Set(landmarkParts.map((part) => part.roomId!))]
        .sort((left, right) => left - right);

      // Every supported declared room gets a physical, always-tactical motif. Rebuilding repeats
      // those placements exactly; the route referee and authored door graph remain byte-stable.
      expect(landmarkParts.length).toBeGreaterThan(expectedPurposeRoomIds.length);
      expect(landmarkParts.every((part) => part.detail !== true)).toBe(true);
      expect(representedRoomIds).toEqual(expectedPurposeRoomIds);
      expect(second).toEqual(first);
      expect(Array.from(plan.grid)).toEqual(before.grid);
      expect(Array.from(plan.bfs)).toEqual(before.bfs);
      expect(Array.from(plan.corridor)).toEqual(before.corridor);
      expect(plan.corridorCells).toEqual(before.corridorCells);
      expect(plan.criticalRoomIds).toEqual(before.criticalRoomIds);
      expect(plan.doors).toEqual(before.doors);
    }
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
    expect(model.lights.some((light) => (
      light.roomPurpose !== undefined
      && roomPurposeReadability(light.roomPurpose).lightPriority >= 2
    ))).toBe(true);
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
    const embalmingSlab = decomposeProp('stone-slab', 0, 0, 0, 1, false, palette, false);

    // A coffin is layered stone, a mushroom has a stem and cap, and historical damage shifts
    // its lid. These checks guard against collapsing the vocabulary back into generic boxes.
    expect(classifyPropKind('weapon-rack')).toBe('weapon-rack');
    expect(classifyPropKind('stone-slab')).toBe('stone-slab');
    expect(sarcophagus.map((part) => part.shape)).toEqual(['box', 'box']);
    expect(mushroom.map((part) => part.shape)).toEqual(['cylinder', 'cone']);
    expect(disturbedLid[1].instance.rotation).not.toBe(disturbedLid[0].instance.rotation);
    expect(disturbedLid[0].instance.sx).toBeGreaterThan(sarcophagus[0].instance.sx);
    expect(embalmingSlab.map((part) => part.shape)).toEqual(['box', 'box']);
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
