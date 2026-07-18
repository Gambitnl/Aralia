/**
 * This file proves that a canonical blueprint becomes honest 3D building
 * parts without losing doors, windows, floors, furnishings, or roof geometry.
 *
 * It exercises the L4 bridge used by real towns. The architectural-identity
 * checks additionally prove that resolved regional wall colors and district
 * facade grammars, physical construction kits, building-role motifs, and
 * permanent history reach rendering as additive dressing while structural
 * geometry remains unchanged.
 */

import {
  buildInterior,
  buildInteriorParts,
  buildBlueprintParts,
  ROOF_PART_TAG,
  FACADE_PART_TAG,
  HISTORY_PART_TAG,
  MATERIAL_PART_TAG,
  MOTIF_PART_TAG,
  WEATHERING_PART_TAG,
  INTERIOR_WALL_COLOR,
  PERIMETER_WALL_COLORS,
  DOOR_LEAF_COLOR,
  WINDOW_PANE_COLOR,
  CEILING_COLOR,
  STAIR_COLOR,
  FURNITURE,
  furnishingSpec,
  type OccupantFigure,
  type OccupantBody,
} from '../interiorParts';
import { generateBuilding, buildingShellHeightM } from '../../interior/generateBuilding';
import { FURNISHING_RECIPE_KINDS } from '../../interior/furnish';
import { blueprintForPlot, generateInterior, type InteriorPlotInput } from '../../interior/generateInterior';
import { isAtWork } from '../groundChunkLoader';
import { EXTERIOR } from '../../interior/types';
import { rootSeedPath } from '../../seedPath';
import { STYLE_FAMILIES } from '../../town/architectureStyle';
import { dressingContrastTone, glazingPaneColor } from '../buildingMaterialParts';
import { blueprintSiteOrigin } from '../../interior/blueprintTypes';

/** Colors that identify structural walls in legacy, unstyled test fixtures. */
const isWallColor = (color: string): boolean =>
  color === INTERIOR_WALL_COLOR || Object.values(PERIMETER_WALL_COLORS).includes(color);

describe('furnishing render coverage (no-fallback)', () => {
  it('every kind the recipes can emit has a 3D render spec', () => {
    const missing = [...FURNISHING_RECIPE_KINDS].filter((kind) => !(kind in FURNITURE)).sort();
    expect(missing).toEqual([]);
  });

  it('resolving an unknown furnishing kind throws instead of dropping it', () => {
    expect(() => furnishingSpec('no-such-furniture')).toThrow(/unknown furnishing kind/i);
  });

  it('resolves a known kind to its spec', () => {
    expect(furnishingSpec('anvil')).toBe(FURNITURE.anvil);
  });
});

const SEED_PATH = rootSeedPath(42);
const FT = 0.3048;
const FLOOR_COLOR = '#9a8a72';
const WALL_THICKNESS_M = 0.3;

const plot = (): InteriorPlotInput => ({
  id: 7,
  footprint: [
    [1000, 2000],
    [1060, 2000],
    [1060, 2045],
    [1000, 2045],
  ],
  role: 'house',
  storeys: 1,
});

/** A plausible adult body (meters + hex) — the BODY-1 projection the renderer
 * now consumes. Placement tests use a fixed body; the variation test below
 * supplies distinct bodies to prove the renderer reads them. */
const body = (over: Partial<OccupantBody> = {}): OccupantBody => ({
  heightM: 1.7,
  shoulderWidthM: 0.45,
  depthM: 0.28,
  headSizeM: 0.25,
  skinToneHex: '#e0ac69',
  clothingHex: '#6e4a3a',
  ...over,
});

const fig = (
  id: number,
  ageBand: 'child' | 'adult' | 'elder',
  atWork?: boolean,
): OccupantFigure => ({ id, ageBand, atWork, body: body() });

it('is deterministic', () => {
  expect(buildInteriorParts(plot(), SEED_PATH, 3)).toEqual(buildInteriorParts(plot(), SEED_PATH, 3));
});

it('produces perimeter + interior walls and furnishings', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  const furnishings = parts.filter((p) => !isWallColor(p.colorHex) && p.colorHex !== FLOOR_COLOR);
  // 4 perimeter lines (front split by the door = at least 5 runs) plus at
  // least one internal wall for a 60×45 multi-room house.
  expect(walls.length).toBeGreaterThanOrEqual(6);
  expect(furnishings.length).toBeGreaterThan(0);
});

describe('visible party-wall ownership', () => {
  const rowBlueprint = (owner: 'earlier-frontage-member' | 'later-frontage-member') =>
    generateBuilding({
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
        ensembleSignature: 'row-wall-owner-proof',
      },
    });

  /** Styled rows exercise every run-driven exterior dressing bridge. */
  const styledRowBlueprint = (owner: 'earlier-frontage-member' | 'later-frontage-member') =>
    generateBuilding({
      buildingId: 315,
      type: 'townhouse',
      seedPath: rootSeedPath(315),
      storeys: 2,
      basement: false,
      style: {
        cultureType: 'River',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'ancient',
        architecture: {
          settlementKey: 'burg:1',
          districtKey: 'district:row',
          buildingKey: 'plot:315',
        },
      },
      ensemble: {
        blockKey: 'ward:1:edge:3',
        kind: 'row',
        partyWallLeft: true,
        partyWallRight: true,
        partyWallOwner: owner,
        eaveStoreys: 2,
        ensembleSignature: 'row-dressing-owner-proof',
      },
    });

  it('keeps the non-owner wall tactical but gives only one frontage neighbor visible masonry', () => {
    const earlierOwns = buildBlueprintParts(
      rowBlueprint('earlier-frontage-member'),
      3,
      PERIMETER_WALL_COLORS.house,
    ).parts;
    const laterOwns = buildBlueprintParts(
      rowBlueprint('later-frontage-member'),
      3,
      PERIMETER_WALL_COLORS.house,
    ).parts;
    const earlierHidden = earlierOwns.filter((part) => part.renderRole === 'tactical-only');
    const laterHidden = laterOwns.filter((part) => part.renderRole === 'tactical-only');

    expect(earlierHidden.length).toBeGreaterThan(0);
    expect(laterHidden.length).toBeGreaterThan(0);
    // If the earlier frontage member owns the seam, this building's left side
    // belongs to its earlier neighbor; reversing ownership hides its right side.
    expect(earlierHidden.every((part) => part.x < 0)).toBe(true);
    expect(laterHidden.every((part) => part.x > 0)).toBe(true);
    expect(earlierOwns.length).toBe(laterOwns.length);
  });

  it('leaves legacy ensemble receipts fully visible', () => {
    const legacy = rowBlueprint('earlier-frontage-member');
    delete legacy.ensemble!.partyWallOwner;
    const parts = buildBlueprintParts(legacy, 3, PERIMETER_WALL_COLORS.house).parts;

    expect(parts.every((part) => part.renderRole === undefined)).toBe(true);
  });

  it('keeps facade trim off the neighbor-owned side', () => {
    for (const owner of ['earlier-frontage-member', 'later-frontage-member'] as const) {
      const blueprint = styledRowBlueprint(owner);
      const legacy = structuredClone(blueprint);
      delete legacy.ensemble!.partyWallOwner;
      const ownedFacade = buildBlueprintParts(
        blueprint,
        3,
        PERIMETER_WALL_COLORS.house,
      ).parts.filter((part) => part.tag === FACADE_PART_TAG);
      const legacyFacade = buildBlueprintParts(
        legacy,
        3,
        PERIMETER_WALL_COLORS.house,
      ).parts.filter((part) => part.tag === FACADE_PART_TAG);

      // The ownerless receipt projects every outer run. Restoring ownership
      // must remove one seam's trim while preserving the remaining grammar.
      expect(ownedFacade.length).toBeGreaterThan(0);
      expect(ownedFacade.length).toBeLessThan(legacyFacade.length);
    }
  });

  it('stores hidden-wall history without projecting it onto the shared exterior', () => {
    const blueprint = styledRowBlueprint('earlier-frontage-member');
    const floor = blueprint.floors.find((candidate) => candidate.level === 0)!;
    const leftIndex = floor.wallRuns.findIndex((run) => run.kind === 'outer' && run.nx === -1);
    const rightIndex = floor.wallRuns.findIndex((run) => run.kind === 'outer' && run.nx === 1);
    const historyFor = (wallRunIndex: number) => ({
      ageBand: 'old' as const,
      phases: blueprint.masses.slice(1).map(() => 0),
      wear: ['patched-wall' as const],
      historySignature: `party-wall-history:${wallRunIndex}`,
      features: [{
        kind: 'patched-wall' as const,
        floorLevel: 0,
        wallRunIndex,
        alongFt: 5,
        widthFt: 2.5,
        baseFt: 1,
        heightFt: 3,
        colorHex: '#78695a',
      }],
    });

    expect(leftIndex).toBeGreaterThanOrEqual(0);
    expect(rightIndex).toBeGreaterThanOrEqual(0);
    blueprint.backstory = historyFor(leftIndex);
    const hidden = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.house).parts;
    blueprint.backstory = historyFor(rightIndex);
    const visible = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.house).parts;

    expect(hidden.filter((part) => part.tag === HISTORY_PART_TAG)).toEqual([]);
    expect(visible.filter((part) => part.tag === HISTORY_PART_TAG).length).toBeGreaterThan(0);
  });

  it('keeps production roof meshes inside party sides while retaining street eaves', () => {
    for (const owner of ['earlier-frontage-member', 'later-frontage-member'] as const) {
      const blueprint = styledRowBlueprint(owner);
      blueprint.backstory = {
        ageBand: 'ancient',
        phases: blueprint.masses.slice(1).map(() => 0),
        wear: ['sagging-ridge'],
        historySignature: `subdivided-row-roof:${owner}`,
        features: [{
          kind: 'sagging-ridge',
          ridgeIndex: 0,
          deflectionFt: 1,
          colorHex: '#594a3d',
        }],
      };
      const output = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.house);
      const positions = output.roof!.positions;
      const xs: number[] = [];
      const zs: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        xs.push(positions[i]);
        zs.push(positions[i + 2]);
      }
      const halfWidthM = blueprint.widthFt * FT / 2;
      const halfDepthM = blueprint.depthFt * FT / 2;

      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-halfWidthM - 1e-5);
      expect(Math.max(...xs)).toBeLessThanOrEqual(halfWidthM + 1e-5);
      expect(Math.min(...zs) < -halfDepthM || Math.max(...zs) > halfDepthM).toBe(true);
    }

    const legacy = styledRowBlueprint('earlier-frontage-member');
    delete legacy.ensemble!.partyWallOwner;
    const legacyXs = Array.from(
      buildBlueprintParts(legacy, 3, PERIMETER_WALL_COLORS.house).roof!.positions,
    ).filter((_, index) => index % 3 === 0);
    expect(Math.min(...legacyXs)).toBeLessThan(-legacy.widthFt * FT / 2);
    expect(Math.max(...legacyXs)).toBeGreaterThan(legacy.widthFt * FT / 2);
  });
});

it('merges wall runs so no wall parts overlap on the same line', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  let overlaps = 0;

  // Wall rectangles that share the same center line should be disjoint in
  // their long axis. This catches the doubled shared-room walls that render
  // as twinned slabs inside a building.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      const bothHorizontal = a.d === WALL_THICKNESS_M && b.d === WALL_THICKNESS_M;
      const bothVertical = a.w === WALL_THICKNESS_M && b.w === WALL_THICKNESS_M;
      if (bothHorizontal && Math.abs(a.z - b.z) < 0.001) {
        const overlap = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
        if (overlap > 0.001) overlaps++;
      }
      if (bothVertical && Math.abs(a.x - b.x) < 0.001) {
        const overlap = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
        if (overlap > 0.001) overlaps++;
      }
    }
  }

  expect(overlaps).toBe(0);
});

it('emits per-cell floor slabs covering the blueprint footprint (Task 12)', () => {
  // The blueprint path replaces the single envelope-spanning plank with one
  // 5 ft slab per footprint cell, following the (possibly irregular) shell.
  const plan = generateInterior(plot(), SEED_PATH);
  const bp = blueprintForPlot(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const floors = parts.filter((p) => p.colorHex === FLOOR_COLOR && (p.baseY ?? 0) === 0);

  expect(floors.length).toBe(bp.footprintCells.length);
  expect(parts[0]).toBe(floors[0]); // slabs come first, under walls and props
  const hw = (plan.widthFt / 2) * FT;
  const hd = (plan.depthFt / 2) * FT;
  for (const slab of floors) {
    expect(slab.h).toBeLessThanOrEqual(0.15);
    expect(Math.abs(slab.x) + slab.w / 2).toBeLessThanOrEqual(hw + 0.01);
    expect(Math.abs(slab.z) + slab.d / 2).toBeLessThanOrEqual(hd + 0.01);
  }
});

it('leaves a real door gap in the entry WALL and dresses it with a door leaf', () => {
  // Task 10 adapter truth: the entry sits on an outer wall of the main room,
  // no longer pinned to the h:0 street line — so assert relative to the
  // entry door's OWN wall line, whichever side it landed on.
  const plan = generateInterior(plot(), SEED_PATH);
  const entry = plan.doorways.find((d) => d.a === EXTERIOR)!;
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);

  const isX = entry.axis === 'x';
  // The entry wall line and door position along it, in part coords (meters).
  const wallLine = isX
    ? (entry.y - plan.depthFt / 2) * FT
    : (entry.x - plan.widthFt / 2) * FT;
  const doorAlong = isX
    ? (entry.x - plan.widthFt / 2) * FT
    : (entry.y - plan.depthFt / 2) * FT;
  // Blueprint walls sit t/2 OUTWARD of their grid line (outer walls are
  // 1.5 ft thick → up to ~0.23 m off the line), so match with that slack.
  const onLine = parts.filter(
    (p) => isWallColor(p.colorHex) && Math.abs((isX ? p.z : p.x) - wallLine) < 0.25,
  );
  // No WALL run blocks the gap (the wall is still cut open — the camera walks
  // through it; IN1's door leaf is a separate, thin dressing, not a wall).
  const wallBlocking = onLine.filter((p) => {
    const lo = isX ? p.x - p.w / 2 : p.z - p.d / 2;
    const hi = isX ? p.x + p.w / 2 : p.z + p.d / 2;
    return doorAlong > lo && doorAlong < hi;
  });
  expect(wallBlocking).toEqual([]);

  // ...but wall still exists beside the gap on the entry wall's line.
  expect(onLine.length).toBeGreaterThanOrEqual(1);

  // IN1: the entry gap is now dressed with a door leaf at the opening.
  const doorX = (entry.x - plan.widthFt / 2) * FT;
  const doorZ = (entry.y - plan.depthFt / 2) * FT;
  const leaf = parts.find(
    (p) =>
      p.colorHex === DOOR_LEAF_COLOR &&
      Math.abs(p.x - doorX) < 0.05 &&
      Math.abs(p.z - doorZ) < 0.05,
  );
  expect(leaf).toBeDefined();
});

it('emits perimeter windows and a single-storey ceiling (IN1/IN2)', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const bp = blueprintForPlot(plot(), SEED_PATH);
  const windows = parts.filter((p) => p.colorHex === WINDOW_PANE_COLOR);
  // Real blueprint windows now: one glazed pane per plan window (habitable
  // rooms are guaranteed glazing by the generator, so at least one exists).
  const ground = bp.floors.find((f) => f.level === 0)!;
  expect(ground.windows.length).toBeGreaterThanOrEqual(1);
  expect(windows.length).toBe(ground.windows.length);

  // The top storey is capped with per-cell ceiling slabs near the shell top
  // so the interior stays enclosed when the roof auto-hides.
  const ceilings = parts.filter((p) => p.colorHex === CEILING_COLOR);
  expect(ceilings.length).toBe(bp.footprintCells.length);
  for (const c of ceilings) expect(c.baseY ?? 0).toBeGreaterThan(2);
});

it('window panes stay dark glass by default (daytime / unlit)', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const windows = parts.filter((p) => p.colorHex === WINDOW_PANE_COLOR);
  expect(windows.length).toBeGreaterThan(0);
  for (const w of windows) expect(w.emissiveHex).toBeUndefined();
});

it('every window pane carries lightRole "window" and NO baked emissive (live lighting)', () => {
  // The bake tags window panes unconditionally; the renderer decides lit/dark
  // live from the building schedule. Build both "lit" and "unlit" (the litWindows
  // flag is now inert): the structural tagging must be identical either way.
  const dark = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, false, false);
  const lit = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, false, true);
  const litWindows = lit.filter((p) => p.lightRole === 'window');
  const darkWindows = dark.filter((p) => p.lightRole === 'window');
  // Same tagged panes, same count — window identity no longer depends on the
  // bake hour / lit flag.
  expect(litWindows.length).toBe(darkWindows.length);
  expect(litWindows.length).toBeGreaterThan(0);
  // Every window-role part IS a window pane, carries no baked emissive.
  for (const w of litWindows) {
    expect(w.colorHex).toBe(WINDOW_PANE_COLOR);
    expect(w.emissiveHex).toBeUndefined();
  }
  // Conversely: every window pane is tagged 'window'.
  const untaggedPanes = lit.filter((p) => p.colorHex === WINDOW_PANE_COLOR && p.lightRole !== 'window');
  expect(untaggedPanes).toEqual([]);
});

it('the now-inert litWindows flag no longer changes any baked part', () => {
  // Lighting is a live render decision, so the bake output is byte-identical
  // whether or not litWindows is set — including the lightRole tags themselves.
  const dark = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, false, false);
  const lit = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, false, true);
  expect(lit).toEqual(dark);
});

it('every hearth furnishing carries lightRole "hearth" and NO baked emissive', () => {
  // The bake tags hearths unconditionally; hearthLit is now inert. The renderer
  // drives the fire live from the building's hearth schedule.
  const cold = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, false, false);
  const warm = buildInteriorParts(plot(), SEED_PATH, 3, [], undefined, undefined, true, false);
  const coldHearths = cold.filter((p) => p.lightRole === 'hearth');
  const warmHearths = warm.filter((p) => p.lightRole === 'hearth');
  // Same hearths whether the (now-inert) hearthLit flag is set or not.
  expect(warmHearths.length).toBe(coldHearths.length);
  expect(warmHearths.length).toBeGreaterThan(0); // a house has a hearth
  for (const hp of warmHearths) expect(hp.emissiveHex).toBeUndefined();
  // hearthLit no longer changes any part either.
  expect(warm).toEqual(cold);
});

it('places occupant figures inside the envelope with stable heights', () => {
  const occupants = [fig(1, 'adult'), fig(2, 'child'), fig(3, 'elder')];
  const base = buildInteriorParts(plot(), SEED_PATH, 3);
  const withPeople = buildInteriorParts(plot(), SEED_PATH, 3, occupants);
  // Each villager is now two parts: a clothed body box + a skin-toned head.
  expect(withPeople.length).toBe(base.length + occupants.length * 2);
  const figures = withPeople.slice(base.length);
  const plan = generateInterior(plot(), SEED_PATH);
  const hw = (plan.widthFt / 2) * FT;
  const hd = (plan.depthFt / 2) * FT;
  const bad = figures.filter(
    (f) => Math.abs(f.x) > hw || Math.abs(f.z) > hd || f.h <= 0 || f.h > 1.8,
  );
  expect(bad).toEqual([]);

  // Time-of-day: a worker stands front-of-house — in the room that owns the
  // entry door (Task 10 adapter truth: the entry room is the main room on
  // whichever wall the entry landed, not necessarily nearest the street) —
  // while the same person at home stands in a different room.
  const entryDoor = plan.doorways.find((d) => d.a === EXTERIOR)!;
  // Task 12: occupants stand at the blueprint room ANCHOR (a cell guaranteed
  // inside the room), not the legacy bbox center which can sit on a wall of
  // an L-shaped room.
  const bp = blueprintForPlot(plot(), SEED_PATH);
  const bpEntryRoom = bp.floors.find((f) => f.level === 0)!.rooms
    .find((r) => r.id === entryDoor.b)!;
  const expectedX = ((bpEntryRoom.anchor.cx + 0.5) * 5 - plan.widthFt / 2) * FT;
  const expectedZ = ((bpEntryRoom.anchor.cy + 0.5) * 5 - plan.depthFt / 2) * FT;
  const homeParts = buildInteriorParts(plot(), SEED_PATH, 3, [fig(1, 'adult')]);
  const workParts = buildInteriorParts(plot(), SEED_PATH, 3, [fig(1, 'adult', true)]);
  const home = homeParts[homeParts.length - 2]; // body box (head is last)
  const atWork = workParts[workParts.length - 2];
  expect(Math.abs(atWork.x - expectedX)).toBeLessThan(0.01);
  expect(Math.abs(atWork.z - expectedZ)).toBeLessThan(0.01);
  expect(Math.abs(home.x - atWork.x) + Math.abs(home.z - atWork.z)).toBeGreaterThan(0.1);
});

it('renders each occupant from its parametric body, not a uniform crate', () => {
  const tall: OccupantFigure = {
    id: 1,
    ageBand: 'adult',
    body: body({ heightM: 1.95, shoulderWidthM: 0.52, depthM: 0.34, headSizeM: 0.27, skinToneHex: '#8d5524', clothingHex: '#4a5e6e' }),
  };
  const small: OccupantFigure = {
    id: 2,
    ageBand: 'child',
    body: body({ heightM: 1.05, shoulderWidthM: 0.3, depthM: 0.2, headSizeM: 0.2, skinToneHex: '#ffdbac', clothingHex: '#5e6e4a' }),
  };
  const base = buildInteriorParts(plot(), SEED_PATH, 3).length;
  const [bodyTall, headTall] = buildInteriorParts(plot(), SEED_PATH, 3, [tall]).slice(base);
  const [bodySmall] = buildInteriorParts(plot(), SEED_PATH, 3, [small]).slice(base);

  // Dimensions and palette track the body, not a hardcoded constant.
  expect(bodyTall.h).toBeGreaterThan(bodySmall.h); // taller body → taller box
  expect(bodyTall.w).toBeCloseTo(0.52, 5); // shoulders → body width
  expect(bodyTall.colorHex).toBe('#4a5e6e'); // clothing palette
  expect(headTall.colorHex).toBe('#8d5524'); // skin tone
  expect(headTall.h).toBeCloseTo(0.27, 5); // head size
  expect(headTall.baseY).toBeCloseTo(bodyTall.h, 5); // head sits on the body
});

it('a populated-household occupant (station identity) is NOT baked into parts', () => {
  // Living interiors: occupants that carry a station are rendered live by the
  // InteriorOccupants layer against the game clock, so they are no longer baked
  // into the static parts. A station figure adds zero parts.
  const base = buildInteriorParts(plot(), SEED_PATH, 3);
  const stationFig: OccupantFigure = {
    ...fig(1, 'adult'),
    station: { xFt: 20, yFt: 20, level: 0 },
  };
  const withStation = buildInteriorParts(plot(), SEED_PATH, 3, [stationFig]);
  expect(withStation.length).toBe(base.length);
  expect(withStation.filter((p) => p.tag === 'occupant')).toEqual([]);
});

it('roster occupants (no station) are still baked and tagged "occupant"', () => {
  // The street/commuter roster fallback stays baked so the "no occupant boxes"
  // assertion elsewhere can key precisely off the 'occupant' tag.
  const parts = buildInteriorParts(plot(), SEED_PATH, 3, [fig(1, 'adult'), fig(2, 'adult')]);
  const occ = parts.filter((p) => p.tag === 'occupant');
  // Two figures × (body box + head box) = 4 tagged parts.
  expect(occ.length).toBe(4);
});

it('places every occupant center away from wall rectangles', () => {
  const occupants = Array.from({ length: 20 }, (_, id) => fig(id, 'adult'));
  const parts = buildInteriorParts(plot(), SEED_PATH, 3, occupants);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  const figures = parts.slice(-occupants.length);
  let violations = 0;

  // Occupant centers need breathing room around wall slabs. A center that is
  // inside or too close to a wall rectangle can render as a villager embedded
  // in plaster at first-person scale.
  for (const figure of figures) {
    for (const wall of walls) {
      const dx = Math.max(Math.abs(figure.x - wall.x) - wall.w / 2, 0);
      const dz = Math.max(Math.abs(figure.z - wall.z) - wall.d / 2, 0);
      const distance = Math.hypot(dx, dz);
      if (distance < 0.4) violations++;
    }
  }

  expect(violations).toBe(0);
});

it('keeps every part inside the interior envelope (plus wall thickness)', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const hw = (plan.widthFt / 2) * FT + 0.31;
  const hd = (plan.depthFt / 2) * FT + 0.31;
  const outside = parts.filter(
    (p) => Math.abs(p.x) > hw || Math.abs(p.z) > hd || p.h <= 0,
  );
  expect(outside).toEqual([]);
});

it('staggered work hours: per-occupant start 7-9, end 16-19, deterministic', () => {
  let violations = 0;
  let staggered = false;
  let firstStart: number | null = null;
  for (let id = 0; id < 60; id++) {
    // Derive this occupant's start/end by scanning hours.
    let start = -1;
    let end = -1;
    for (let h = 0; h < 24; h++) {
      const at = isAtWork(id, h);
      if (at && start === -1) start = h;
      if (!at && start !== -1 && end === -1) end = h;
    }
    if (start < 7 || start > 9 || end < 16 || end > 19) violations++;
    if (isAtWork(id, 12) !== isAtWork(id, 12)) violations++;
    if (firstStart === null) firstStart = start;
    else if (start !== firstStart) staggered = true;
  }
  expect(violations).toBe(0);
  // At least two occupants in 60 differ — the whole town must not move in
  // lockstep (the v1 behavior this replaces).
  expect(staggered).toBe(true);
});

it('interior doorway gaps are open through coincident duplicate walls', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  let blocked = 0;
  for (const door of plan.doorways) {
    if (door.a === EXTERIOR) continue;
    const dx = (door.x - plan.widthFt / 2) * FT;
    const dz = (door.y - plan.depthFt / 2) * FT;
    for (const p of parts) {
      if (!isWallColor(p.colorHex)) continue;
      const inX = dx > p.x - p.w / 2 + 0.01 && dx < p.x + p.w / 2 - 0.01;
      const inZ = dz > p.z - p.d / 2 + 0.01 && dz < p.z + p.d / 2 - 0.01;
      if (inX && inZ) blocked++;
    }
  }
  expect(blocked).toBe(0);
});

describe('solved roof parts (BGv2 Task 5)', () => {
  // A styled plan carries plan.roof + plan.styleResolved; a bare plan does not.
  const styled = () =>
    generateBuilding({
      buildingId: 7, type: 'manor', seedPath: rootSeedPath(7),
      storeys: 2, basement: false,
      style: {
        cultureType: 'Generic',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'new',
        architecture: {
          settlementKey: 'burg:17',
          districtKey: 'wealth:common',
          buildingKey: 'plot:7',
        },
      },
    });
  const bare = () =>
    generateBuilding({
      buildingId: 7, type: 'manor', seedPath: rootSeedPath(7),
      storeys: 2, basement: false,
    });

  it('a roofless plan yields NO roof group and byte-stable parts', () => {
    const bp = bare();
    expect(bp.roof).toBeUndefined();
    const out = buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false);
    expect(out.roof).toBeUndefined();
    // Parts identical to the plain structure walk (roof adds nothing).
    const out2 = buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false);
    expect(out.parts).toEqual(out2.parts);
    // No part carries the roof tag.
    expect(out.parts.some((p) => p.tag === ROOF_PART_TAG)).toBe(false);
  });

  it('a styled plan raises a roof group colored from styleResolved', () => {
    const bp = styled();
    expect(bp.roof).toBeDefined();
    expect(bp.styleResolved).toBeDefined();
    const out = buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false);
    expect(out.roof).toBeDefined();
    // Roof tris are real geometry in METERS, colored with the resolved roof tint.
    expect(out.roof!.positions.length).toBeGreaterThan(0);
    expect(out.roof!.positions.length % 3).toBe(0);
    expect(out.roof!.colorHex).toBe(bp.styleResolved!.roofColor);
    expect(Array.from(out.roof!.positions).every(Number.isFinite)).toBe(true);
  });

  it('style dressing does not move the permanent structure geometry', () => {
    // Roof and facade dressing are additive, and regional color may repaint an
    // outer wall. Strip those presentation facts before comparing the actual
    // wall/floor/stair boxes against the bare building.
    const structuralGeometry = (bp: ReturnType<typeof styled>) =>
      buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false)
        .parts
        .filter((part) =>
          part.tag !== ROOF_PART_TAG &&
          part.tag !== FACADE_PART_TAG &&
          part.tag !== MATERIAL_PART_TAG &&
          part.tag !== MOTIF_PART_TAG &&
          part.tag !== HISTORY_PART_TAG)
        .map((part) => ({
          x: part.x,
          z: part.z,
          w: part.w,
          d: part.d,
          h: part.h,
          baseY: part.baseY,
          lightRole: part.lightRole,
        }));
    expect(structuralGeometry(styled())).toEqual(structuralGeometry(bare()));
  });

  it('resolved district walls and facade grammar reach the visible 3D parts', () => {
    const blueprint = styled();
    const out = buildBlueprintParts(
      blueprint,
      3,
      PERIMETER_WALL_COLORS.house,
      false,
    );
    const style = blueprint.styleResolved!;

    // The production bridge formerly discarded style.wallColor and painted
    // every blueprint wall with a generic role color. At least one real outer
    // wall must now carry the resolved district material.
    expect(out.parts.filter((part) =>
      part.tag !== FACADE_PART_TAG &&
      part.tag !== MOTIF_PART_TAG &&
      part.colorHex === style.wallColor).length)
      .toBeGreaterThan(0);

    // This fixture resolves to half-timber: shallow horizontal courses plus
    // vertical bays, all in the family trim pushed to the contrast tone
    // (town-look-slice1) so the grammar actually reads against the wall color.
    expect(style.facadePattern).toBe('half-timber');
    const facade = out.parts.filter((part) => part.tag === FACADE_PART_TAG);
    expect(facade.length).toBeGreaterThan(0);
    expect(facade.every((part) =>
      part.colorHex === dressingContrastTone(style.trimColor, style.wallColor))).toBe(true);
    expect(facade.some((part) => part.w > part.d)).toBe(true);
    expect(facade.some((part) => part.d > part.w)).toBe(true);
  });

  it('projects the resolved construction kit into material-tagged 3D evidence', () => {
    const blueprint = styled();
    const out = buildBlueprintParts(
      blueprint,
      3,
      PERIMETER_WALL_COLORS.house,
      false,
    );
    const construction = blueprint.styleResolved!.construction;
    const materialParts = out.parts.filter((part) =>
      part.tag === MATERIAL_PART_TAG);
    const materialKinds = new Set(
      materialParts.map((part) => part.materialDetailKind),
    );

    expect(materialParts.length).toBeGreaterThan(0);
    expect(materialParts.every((part) => part.materialDetailKind)).toBe(true);
    expect(materialKinds.has('foundation')).toBe(true);
    expect(materialKinds.has('roof-edge')).toBe(true);
    // Wall-mounted material dressing renders in the contrast-derived trim tone
    // (town-look-slice1); roof-edge dressing keeps the covering color.
    expect(materialParts.every((part) =>
      part.colorHex === dressingContrastTone(
        blueprint.styleResolved!.trimColor,
        blueprint.styleResolved!.wallColor,
      )
      || part.colorHex === blueprint.styleResolved!.roofColor)).toBe(true);

    // Shutter panels are paired beside every real above-grade window. A kit
    // with no shutters intentionally emits none rather than inventing closures.
    const windowCount = blueprint.floors
      .filter((floor) => floor.level >= 0)
      .reduce((total, floor) => total + floor.windows.length, 0);
    const shutterPanels = materialParts.filter((part) =>
      part.materialDetailKind === 'shutter-panel');
    expect(shutterPanels).toHaveLength(
      construction.shutters === 'none' ? 0 : windowCount * 2,
    );

    // Glazing quality repaints the canonical panes instead of laying a second
    // surface over them, so lighting can still find one exact window part.
    const panes = out.parts.filter((part) => part.lightRole === 'window');
    expect(panes.length).toBe(windowCount);
    expect(panes.every((part) =>
      part.colorHex === glazingPaneColor(construction.glazing))).toBe(true);
  });

  it('makes the five culture families visibly distinct through physical materials', () => {
    const cultures = ['Highland', 'Naval', 'River', 'Hunting', 'Generic'] as const;
    const proofs = cultures.map((cultureType) => {
      const blueprint = generateBuilding({
        buildingId: 41,
        type: 'manor',
        seedPath: rootSeedPath(4141),
        storeys: 2,
        basement: false,
        style: {
          cultureType,
          climate: 'temperate',
          wealth: 'common',
          ageBand: 'new',
          architecture: {
            settlementKey: `burg:${cultureType}`,
            districtKey: 'district:2',
            buildingKey: 'plot:41',
          },
        },
      });
      const parts = buildBlueprintParts(
        blueprint,
        3,
        PERIMETER_WALL_COLORS.house,
        false,
      ).parts.filter((part) => part.tag === MATERIAL_PART_TAG);
      return {
        construction: blueprint.styleResolved!.construction,
        geometry: JSON.stringify(parts.map((part) => ({
          kind: part.materialDetailKind,
          w: part.w,
          d: part.d,
          h: part.h,
          colorHex: part.colorHex,
        }))),
      };
    });

    expect(new Set(proofs.map((proof) => proof.construction.kitId)).size).toBe(5);
    expect(new Set(proofs.map((proof) => proof.construction.wallMaterial)).size)
      .toBeGreaterThan(3);
    expect(new Set(proofs.map((proof) => proof.construction.roofCovering)).size)
      .toBeGreaterThan(3);
    expect(new Set(proofs.map((proof) => proof.geometry)).size).toBe(5);
  });

  it.each([
    ['shop', 'hanging-sign', 2],
    ['smithy', 'vent-stack', 1],
    ['workshop', 'loading-hoist', 2],
    ['farmstead', 'side-shed', 1],
    ['temple', 'bell-cote', 2],
    ['keep', 'battlements', 3],
  ] as const)('renders the %s recognition program as palette-bound motif parts', (
    buildingType,
    expectedCoreMotif,
    storeys,
  ) => {
    // The same district and culture frame every role. The role resolver is the
    // only changing input, so these assertions prove a shop sign or keep crown
    // survives all the way into the production 3D box list.
    const blueprint = generateBuilding({
      buildingId: 800 + storeys,
      type: buildingType,
      seedPath: rootSeedPath(1800 + storeys),
      storeys,
      basement: false,
      style: {
        cultureType: 'Generic',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'new',
        architecture: {
          settlementKey: 'burg:motif-proof',
          districtKey: 'district:market-east',
          buildingKey: `plot:${buildingType}`,
        },
      },
    });
    const out = buildBlueprintParts(
      blueprint,
      3,
      PERIMETER_WALL_COLORS.house,
      false,
    );
    const motifParts = out.parts.filter((part) => part.tag === MOTIF_PART_TAG);
    const renderedMotifs = new Set(motifParts.map((part) => part.motifKind));
    const palette = new Set([
      blueprint.styleResolved!.wallColor,
      blueprint.styleResolved!.roofColor,
      blueprint.styleResolved!.trimColor,
    ]);

    expect(motifParts.length).toBeGreaterThan(0);
    expect(renderedMotifs.has(expectedCoreMotif)).toBe(true);
    expect(renderedMotifs).toEqual(new Set(blueprint.styleResolved!.motifs));
    expect(motifParts.every((part) => palette.has(part.colorHex))).toBe(true);
  });

  it('renders every resolved history fact as separately tagged semantic evidence', () => {
    const blueprint = generateBuilding({
      buildingId: 77,
      type: 'manor',
      seedPath: rootSeedPath(7077),
      storeys: 2,
      basement: false,
      style: {
        cultureType: 'Generic',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'ancient',
        architecture: {
          settlementKey: 'burg:history-proof',
          districtKey: 'district:old-core',
          buildingKey: 'plot:77',
        },
      },
    });
    const out = buildBlueprintParts(
      blueprint,
      buildingShellHeightM(2) / 2,
      PERIMETER_WALL_COLORS.house,
      false,
    );
    const historyParts = out.parts.filter((part) =>
      part.tag === HISTORY_PART_TAG);
    const featureKinds = new Set(
      blueprint.backstory!.features.map((feature) => feature.kind),
    );

    expect(blueprint.backstory!.wear).toHaveLength(3);
    expect(historyParts.length).toBeGreaterThan(0);
    expect(historyParts.every((part) => part.historyKind)).toBe(true);
    expect(new Set(historyParts.map((part) => part.historyKind)))
      .toEqual(featureKinds);
    expect(historyParts.every((part) =>
      Number.isFinite(part.x) &&
      Number.isFinite(part.z) &&
      Number.isFinite(part.h) &&
      part.w > 0 &&
      part.d > 0 &&
      part.h > 0)).toBe(true);
  });

  it('projects replayed fire and abandonment state without changing tactical structure', () => {
    const blueprint = generateBuilding({
      buildingId: 78,
      type: 'tavern',
      seedPath: rootSeedPath(7078),
      storeys: 2,
      basement: false,
      style: {
        cultureType: 'River',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'old',
        architecture: {
          settlementKey: 'burg:live-history-proof',
          districtKey: 'district:riverfront',
          buildingKey: 'plot:78',
        },
      },
      eventLog: [
        {
          day: 40,
          kind: 'fire-damage',
          payload: { incidentId: 'proof-fire', severity: 3 },
        },
        { day: 60, kind: 'abandonment', payload: { boardedFraction: 1 } },
      ],
    });
    const out = buildBlueprintParts(
      blueprint,
      buildingShellHeightM(2) / 2,
      PERIMETER_WALL_COLORS.house,
      false,
    );
    const historyParts = out.parts.filter((part) => part.tag === HISTORY_PART_TAG);
    const liveKinds = new Set(
      blueprint.liveHistory!.features.map((feature) => feature.kind),
    );

    expect(liveKinds).toEqual(new Set(['scorched-room', 'roof-hole', 'boarded-window']));
    expect(new Set(historyParts.map((part) => part.historyKind)))
      .toEqual(new Set([
        ...blueprint.backstory!.features.map((feature) => feature.kind),
        ...liveKinds,
      ]));
    expect(historyParts.filter((part) => part.historyKind === 'boarded-window').length)
      .toBe(blueprint.floors.filter((floor) => floor.level >= 0)
        .reduce((sum, floor) => sum + floor.windows.length * 3, 0));
    // The production bridge carries a physical opening in its roof group and
    // retains only the four tagged charred rim bars as semantic SiteParts.
    expect(historyParts.filter((part) => part.historyKind === 'roof-hole')).toHaveLength(4);
    expect(out.roof).toBeDefined();
    const hole = blueprint.liveHistory!.features.find((feature) => feature.kind === 'roof-hole');
    expect(hole).toBeDefined();
    const origin = blueprintSiteOrigin(blueprint);
    for (let i = 0; i < out.roof!.positions.length; i += 9) {
      const centerXFt = (
        out.roof!.positions[i] + out.roof!.positions[i + 3] + out.roof!.positions[i + 6]
      ) / (3 * 0.3048) + origin.x;
      const centerYFt = (
        out.roof!.positions[i + 2] + out.roof!.positions[i + 5] + out.roof!.positions[i + 8]
      ) / (3 * 0.3048) + origin.y;
      expect(Math.hypot(centerXFt - hole!.x, centerYFt - hole!.y))
        .toBeGreaterThanOrEqual(hole!.radiusFt - 1e-5);
    }
  });

  it('history dressing leaves the permanent structure byte-identical across ages', () => {
    const make = (ageBand: 'new' | 'ancient') => generateBuilding({
      buildingId: 15,
      type: 'manor',
      seedPath: rootSeedPath(1515),
      storeys: 2,
      basement: true,
      style: {
        cultureType: 'Generic',
        climate: 'temperate',
        wealth: 'common',
        ageBand,
      },
    });
    const structuralParts = (blueprint: ReturnType<typeof make>) =>
      buildBlueprintParts(
        blueprint,
        buildingShellHeightM(2) / 2,
        PERIMETER_WALL_COLORS.house,
        false,
      ).parts.filter((part) =>
        part.tag !== ROOF_PART_TAG &&
        part.tag !== FACADE_PART_TAG &&
        part.tag !== MATERIAL_PART_TAG &&
        part.tag !== MOTIF_PART_TAG &&
        part.tag !== WEATHERING_PART_TAG &&
        part.tag !== HISTORY_PART_TAG);

    expect(structuralParts(make('ancient'))).toEqual(structuralParts(make('new')));
  });

  it('horizontal log courses stop at window openings', () => {
    const source = styled();
    // generateBuilding memoizes plans, so copy the resolved style rather than
    // mutating the shared fixture and leaking this grammar into later tests.
    const blueprint = {
      ...source,
      styleResolved: {
        ...source.styleResolved!,
        facadePattern: 'log-bands' as const,
      },
    };
    const parts = buildBlueprintParts(
      blueprint,
      3,
      PERIMETER_WALL_COLORS.house,
      false,
    ).parts;
    const bands = parts.filter((part) => part.tag === FACADE_PART_TAG);
    const panes = parts.filter((part) => part.lightRole === 'window');

    expect(bands.length).toBeGreaterThan(0);
    expect(panes.length).toBeGreaterThan(0);

    // Compare only bands and panes on the same wall plane. Facade trim projects
    // beyond the wall, so its normal-axis box intentionally does not intersect
    // the pane even when the two would overlap in the elevation view.
    for (const band of bands) {
      const bandRunsAlongX = band.w > band.d;
      for (const pane of panes) {
        const paneRunsAlongX = pane.w > pane.d;
        if (bandRunsAlongX !== paneRunsAlongX) continue;
        const sameWall = bandRunsAlongX
          ? Math.abs(band.z - pane.z) < 1
          : Math.abs(band.x - pane.x) < 1;
        if (!sameWall) continue;

        const bandAlong = bandRunsAlongX
          ? [band.x - band.w / 2, band.x + band.w / 2]
          : [band.z - band.d / 2, band.z + band.d / 2];
        const paneAlong = paneRunsAlongX
          ? [pane.x - pane.w / 2, pane.x + pane.w / 2]
          : [pane.z - pane.d / 2, pane.z + pane.d / 2];
        const overlapsAlong = bandAlong[0] < paneAlong[1] - 1e-6
          && bandAlong[1] > paneAlong[0] + 1e-6;
        // SitePart permits an omitted baseY for ground-seated legacy boxes.
        // Generated facade and pane parts set it, but using the contract's
        // zero default here keeps this assertion honest for either shape.
        const bandBaseY = band.baseY ?? 0;
        const paneBaseY = pane.baseY ?? 0;
        const overlapsVertically = bandBaseY < paneBaseY + pane.h - 1e-6
          && bandBaseY + band.h > paneBaseY + 1e-6;
        expect(overlapsAlong && overlapsVertically).toBe(false);
      }
    }
  });

  it('chimney dressing is tagged and colored from the resolved trim', () => {
    // A single-storey tavern raises its hearth chimney on the (only) top floor.
    const bp = generateBuilding({
      buildingId: 1, type: 'tavern', seedPath: rootSeedPath(1),
      storeys: 1, basement: false,
      style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
    });
    expect(bp.roof!.chimneys.length).toBeGreaterThan(0);
    const out = buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false);
    const roofParts = out.parts.filter((p) => p.tag === ROOF_PART_TAG);
    expect(roofParts.length).toBeGreaterThan(0);
    // At least one trim-colored roof part = the chimney flue.
    const chimneys = roofParts.filter((p) => p.colorHex === bp.styleResolved!.trimColor);
    expect(chimneys.length).toBe(bp.roof!.chimneys.length);
    // Every roof-dressing part is either trim (chimney) or roof (dormer) tinted.
    for (const p of roofParts) {
      expect([bp.styleResolved!.trimColor, bp.styleResolved!.roofColor]).toContain(p.colorHex);
    }
  });

  it('is deterministic', () => {
    const bp = styled();
    expect(buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false))
      .toEqual(buildBlueprintParts(bp, 3, PERIMETER_WALL_COLORS.house, false));
  });
});

// ── Roof seating regression (BGv2 Phase 1B, 2026-07-07). The town bake (the
// REAL path: groundChunkLoader → buildInterior with shellHeightM =
// buildingShellHeightM(storeys), i.e. storeys × 3.048 m / 10 ft feet-canon)
// must land the solved roof's EAVE on the above-grade envelope top for every
// storey count, with and without a basement — otherwise tall buildings render
// as open-topped boxes with the roof sunk a storey below the wall tops. This
// asserts straight off the bridge output (buildInterior's roof group in
// METERS), the real defect's oracle: the roof's lowest vertex (the eave) sits
// at the above-grade wall/ceiling top, allowing only the pitch eave overhang
// (~0.5 ft = 0.152 m) below it and never a whole storey.
describe('roof eave seats on the above-grade wall top (town bake)', () => {
  const FT_M = 0.3048;
  const METERS_PER_STOREY = buildingShellHeightM(1); // mirrors the real loader path
  const EAVE_OVERHANG_M = 0.6 * FT_M; // roof eave dips ≤ ~0.5 ft below wall top

  // A styled house plot (style ⇒ the plan resolves a solved roof).
  const stylePlot = (storeys: number): InteriorPlotInput => ({
    id: 7,
    footprint: [[1000, 2000], [1060, 2000], [1060, 2045], [1000, 2045]],
    role: 'house',
    storeys,
    style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
  });

  const roofMinY = (roof: { positions: Float32Array }): number => {
    let m = Infinity;
    for (let i = 1; i < roof.positions.length; i += 3) m = Math.min(m, roof.positions[i]);
    return m;
  };

  for (const storeys of [1, 2, 3]) {
    it(`${storeys}-storey: roof eave at the above-grade envelope top`, () => {
      const plot = stylePlot(storeys);
      const shellHeightM = storeys * METERS_PER_STOREY;
      const built = buildInterior(plot, SEED_PATH, shellHeightM);
      expect(built.roof).toBeDefined();
      // The above-grade envelope top = storeys × per-storey height (all floors
      // are above grade for these plots), in meters.
      const wallTopM = storeys * (shellHeightM / storeys); // == shellHeightM
      const eaveY = roofMinY(built.roof!);
      // The eave sits at the wall top, dipping only the pitch overhang below it —
      // never a whole storey (which would be the open-topped defect).
      expect(eaveY).toBeGreaterThan(wallTopM - EAVE_OVERHANG_M - 1e-6);
      expect(eaveY).toBeLessThanOrEqual(wallTopM + 1e-6);
      // Hard guard against the reported symptom: the eave is NOT a storey low.
      expect(wallTopM - eaveY).toBeLessThan(shellHeightM / storeys);
    });
  }

  it('roof eave still seats correctly WITH a basement (below-grade floor ignored)', () => {
    // A tavern almost always digs a cellar (BASEMENT_CHANCE). The below-grade
    // floor must NOT push the roof down: the eave stays on the ABOVE-grade top.
    const plot: InteriorPlotInput = {
      id: 9,
      footprint: [[1000, 2000], [1060, 2000], [1060, 2045], [1000, 2045]],
      role: 'tavern',
      storeys: 2,
      style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
    };
    const shellHeightM = 2 * METERS_PER_STOREY; // above-grade storeys only
    const built = buildInterior(plot, SEED_PATH, shellHeightM);
    expect(built.roof).toBeDefined();
    const eaveY = roofMinY(built.roof!);
    expect(eaveY).toBeGreaterThan(shellHeightM - EAVE_OVERHANG_M - 1e-6);
    expect(eaveY).toBeLessThanOrEqual(shellHeightM + 1e-6);
  });
});

// ── Roof eave must OVERHANG the exterior wall (BGv2 Phase 1B, 2026-07-07).
// The solver sets the eave `eaveOverhangFt` (1 ft) beyond the footprint grid
// line, but the OUTER walls grow OUTWARD `OUTER_THICKNESS_FT` (1.5 ft) beyond
// that same line — so the roof eave lands 0.5 ft INSIDE the outer wall face,
// leaving the wall top exposed as a thin rim all around. On tall buildings that
// exposed rim reads as an "open-topped box" (the roof looks recessed a storey).
// The eave must reach AT LEAST the outer wall face (ideally overhang it), so the
// roof caps the wall with no exposed rim.
describe('roof eave overhangs the exterior wall (no exposed rim)', () => {
  const FT_M = 0.3048;
  // Styled blueprints now paint outer walls from their resolved family palette;
  // legacy role colors remain valid for bare fixtures.
  const PERIM = new Set([
    ...Object.values(PERIMETER_WALL_COLORS),
    ...STYLE_FAMILIES.temperateFrame.wallPalette,
  ]);

  const stylePlot = (storeys: number, role = 'house'): InteriorPlotInput => ({
    id: 3,
    footprint: [[1000, 2000], [1060, 2000], [1060, 2045], [1000, 2045]],
    role,
    storeys,
    style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
  });

  // Half-extent (max |coord| + half-size) of the perimeter walls vs the roof
  // eave ring (roof vertices at the minimum Y), in the shared site-local frame.
  const extents = (built: ReturnType<typeof buildInterior>) => {
    let wallX = -Infinity, wallZ = -Infinity;
    for (const p of built.parts) {
      // Eave coverage is a wall-shell invariant. Attached sheds, bays, and
      // other role motifs may intentionally project beyond the main roof.
      if (p.tag === MOTIF_PART_TAG || p.tag === FACADE_PART_TAG) continue;
      if (!PERIM.has(p.colorHex)) continue;
      if ((p.baseY ?? 0) < -0.01) continue;
      wallX = Math.max(wallX, Math.abs(p.x) + p.w / 2);
      wallZ = Math.max(wallZ, Math.abs(p.z) + p.d / 2);
    }
    const pos = built.roof!.positions;
    let eaveY = Infinity;
    for (let i = 1; i < pos.length; i += 3) eaveY = Math.min(eaveY, pos[i]);
    let eaveX = -Infinity, eaveZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.abs(pos[i + 1] - eaveY) < 0.05) {
        eaveX = Math.max(eaveX, Math.abs(pos[i]));
        eaveZ = Math.max(eaveZ, Math.abs(pos[i + 2]));
      }
    }
    return { wallX, wallZ, eaveX, eaveZ };
  };

  for (const storeys of [1, 2, 3]) {
    it(`${storeys}-storey: roof eave reaches beyond the outer wall face`, () => {
      const built = buildInterior(stylePlot(storeys), SEED_PATH, buildingShellHeightM(storeys));
      expect(built.roof).toBeDefined();
      const { wallX, wallZ, eaveX, eaveZ } = extents(built);
      // The eave must cover the wall top — reach AT LEAST the outer face (a hair
      // of tolerance), so no exposed wall rim rings the roof.
      expect(eaveX).toBeGreaterThanOrEqual(wallX - 1e-6);
      expect(eaveZ).toBeGreaterThanOrEqual(wallZ - 1e-6);
    });
  }
});

describe('multi-storey parts', () => {
  const STAIR_COLOR = '#7a5a36';
  const tall = (storeys: number): InteriorPlotInput => ({
    id: 7,
    footprint: [[1000, 2000], [1055, 2000], [1055, 2040], [1000, 2040]],
    role: 'house',
    storeys,
  });

  it('a single-storey building emits no multi-storey structure', () => {
    // No upper-floor slabs and no stair flights. (Door lintels, window panes and
    // the IN2 ceiling legitimately carry a baseY now, so we check for the absence
    // of multi-storey markers — floor-color slabs above ground and stairs —
    // rather than a blanket no-baseY.)
    const parts = buildInteriorParts(plot(), SEED_PATH, 6);
    const elevatedFloorSlabs = parts.filter(
      (p) => p.colorHex === FLOOR_COLOR && (p.baseY ?? 0) > 0,
    );
    expect(elevatedFloorSlabs).toHaveLength(0);
    expect(parts.some((p) => p.colorHex === STAIR_COLOR)).toBe(false);
  });

  it('emits stacked upper floors at rising elevations + a stair flight per gap', () => {
    const storeys = 3;
    const shellH = 9;
    const parts = buildInteriorParts(tall(storeys), SEED_PATH, shellH);
    const storeyH = shellH / storeys;

    // Per-cell floor slabs at each upper level's elevation (Task 12: the
    // blueprint emits one 5 ft slab per footprint cell per level).
    const slabYs = parts
      .filter((p) => p.colorHex === FLOOR_COLOR && (p.baseY ?? 0) > 0)
      .map((p) => p.baseY as number);
    const uniqueYs = [...new Set(slabYs.map((y) => Math.round(y * 1e6) / 1e6))].sort((a, b) => a - b);
    expect(uniqueYs.length).toBe(2);
    expect(uniqueYs[0]).toBeCloseTo(storeyH, 5);
    expect(uniqueYs[1]).toBeCloseTo(2 * storeyH, 5);

    // One STEPPED stair flight per gap (Fix A 2026-07-06): each flight is now
    // many step boxes, not one full-height box. Group step boxes by their shaft
    // (x/z within a step depth) and assert one flight per gap, each spanning a
    // storey from its floor (min base → max tread top ≈ storeyH).
    const stairBoxes = parts.filter((p) => p.colorHex === STAIR_COLOR);
    expect(stairBoxes.length).toBeGreaterThan(storeys - 1); // stepped, not monolithic
    const flightKey = (s: (typeof stairBoxes)[number]): string =>
      `${Math.round((s.baseY ?? 0) / storeyH)}`; // group by originating storey
    const byFlight = new Map<string, typeof stairBoxes>();
    for (const s of stairBoxes) {
      const k = flightKey(s);
      byFlight.set(k, [...(byFlight.get(k) ?? []), s]);
    }
    expect(byFlight.size).toBe(storeys - 1);
    const flightBases: number[] = [];
    for (const flight of byFlight.values()) {
      const base = Math.min(...flight.map((s) => s.baseY ?? 0));
      const top = Math.max(...flight.map((s) => (s.baseY ?? 0) + s.h));
      expect(top - base).toBeCloseTo(storeyH, 5); // spans a full storey
      flightBases.push(base);
    }
    flightBases.sort((a, b) => a - b);
    expect(flightBases[0]).toBeCloseTo(0, 5);
    expect(flightBases[1]).toBeCloseTo(storeyH, 5);

    // Upper floors contribute interior walls + furniture above the ground.
    const elevatedWalls = parts.filter((p) => p.colorHex === INTERIOR_WALL_COLOR && (p.baseY ?? 0) > 0);
    expect(elevatedWalls.length).toBeGreaterThan(0);
  });

  it('keeps every elevated part within the interior envelope (x/z bounds)', () => {
    const plan = generateInterior(tall(3), SEED_PATH);
    const halfW = (plan.widthFt / 2) * FT + WALL_THICKNESS_M;
    const halfD = (plan.depthFt / 2) * FT + WALL_THICKNESS_M;
    for (const p of buildInteriorParts(tall(3), SEED_PATH, 9)) {
      if ((p.baseY ?? 0) === 0) continue;
      expect(Math.abs(p.x) - p.w / 2).toBeLessThanOrEqual(halfW + 0.01);
      expect(Math.abs(p.z) - p.d / 2).toBeLessThanOrEqual(halfD + 0.01);
    }
  });

  it('is deterministic for a multi-storey building', () => {
    expect(buildInteriorParts(tall(4), SEED_PATH, 12)).toEqual(buildInteriorParts(tall(4), SEED_PATH, 12));
  });

  it('houses resident occupants on the upper floors, not just the ground', () => {
    // Enough residents that the room cycle spills upstairs.
    const residents = Array.from({ length: 14 }, (_, i) => fig(i + 1, 'adult', false));
    const shellH = 9;
    const parts = buildInteriorParts(tall(3), SEED_PATH, shellH);
    const clothing = body().clothingHex;
    const bodies = parts.filter((p) => p.colorHex === clothing);
    expect(bodies).toHaveLength(0); // sanity: no occupants passed yet → no bodies

    const peopled = buildInteriorParts(tall(3), SEED_PATH, shellH, residents);
    const occupantBodies = peopled.filter((p) => p.colorHex === clothing);
    expect(occupantBodies).toHaveLength(residents.length);
    // At least one resident stands on an upper storey (baseY at a floor elevation).
    const storeyH = shellH / 3;
    const upstairs = occupantBodies.filter((p) => (p.baseY ?? 0) > 0);
    expect(upstairs.length).toBeGreaterThan(0);
    for (const p of upstairs) {
      const level = Math.round((p.baseY ?? 0) / storeyH);
      expect(p.baseY).toBeCloseTo(level * storeyH, 5); // lands exactly on a storey
      expect(level).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('basements (blueprint-primary path, v1)', () => {
  // Pinned rolls under rootSeedPath(42): tavern plot 21 digs a cellar
  // (rollBasement), house plot 7 (the shared `plot()` above) does not.
  const tavern = (): InteriorPlotInput => ({
    id: 21,
    footprint: [
      [1000, 2000],
      [1070, 2000],
      [1070, 2055],
      [1000, 2055],
    ],
    role: 'tavern',
    storeys: 2,
  });
  const SHELL_H = 6; // meters, 2 storeys → storeyHeightM = 3

  it('a basement-rolling plot produces below-grade mesh data', () => {
    const parts = buildInteriorParts(tavern(), SEED_PATH, SHELL_H);
    const below = parts.filter((p) => (p.baseY ?? 0) < 0);
    expect(below.length).toBeGreaterThan(0);
    // Cellar slab sits exactly one storey below grade.
    const cellarSlab = below.filter((p) => p.colorHex === FLOOR_COLOR);
    expect(cellarSlab.length).toBeGreaterThan(0);
    for (const s of cellarSlab) expect(s.baseY).toBeCloseTo(-3, 5);
    // A STEPPED stair flight (Fix A 2026-07-06) rises from the cellar floor a
    // full storey to grade: many step boxes, all based at -3, whose tread tops
    // climb from just above -3 up to exactly grade (0).
    const stair = below.filter((p) => p.colorHex === STAIR_COLOR);
    expect(stair.length).toBeGreaterThan(1); // stepped, not one monolith
    for (const s of stair) expect(s.baseY).toBeCloseTo(-3, 5);
    const stairTops = stair.map((s) => (s.baseY ?? 0) + s.h);
    expect(Math.max(...stairTops)).toBeCloseTo(0, 5); // top tread reaches grade
    expect(Math.min(...stairTops)).toBeGreaterThan(-3); // lowest tread climbs
    // Below-grade walls top out AT grade (never poke through the ground floor).
    for (const p of below) expect((p.baseY ?? 0) + p.h).toBeLessThanOrEqual(1e-6 + 0);
  });

  it('the ground slab has a stair HOLE over the cellar stair; the cellar slab is solid', () => {
    const parts = buildInteriorParts(tavern(), SEED_PATH, SHELL_H);
    const slabCells = (pred: (b: number) => boolean): number =>
      parts.filter((p) => p.colorHex === FLOOR_COLOR && pred(p.baseY ?? 0)).length;
    const groundCells = slabCells((b) => b === 0);
    const cellarCells = slabCells((b) => b < 0);
    // Same footprint on every level; the ground slab is short exactly the
    // one 5 ft cell the cellar stair pierces.
    expect(cellarCells).toBe(groundCells + 1);
  });

  it('a basement has zero below-grade windows', () => {
    const parts = buildInteriorParts(tavern(), SEED_PATH, SHELL_H);
    const belowWindows = parts.filter(
      (p) => p.colorHex === WINDOW_PANE_COLOR && (p.baseY ?? 0) < 0,
    );
    expect(belowWindows).toEqual([]);
    // Sanity: above-grade windows exist, so the filter is meaningful.
    expect(parts.some((p) => p.colorHex === WINDOW_PANE_COLOR)).toBe(true);
  });

  it('a plot that rolls no basement produces nothing below grade', () => {
    const parts = buildInteriorParts(plot(), SEED_PATH, 3);
    expect(parts.filter((p) => (p.baseY ?? 0) < 0)).toEqual([]);
  });

  it('is deterministic including the basement roll', () => {
    expect(buildInteriorParts(tavern(), SEED_PATH, SHELL_H))
      .toEqual(buildInteriorParts(tavern(), SEED_PATH, SHELL_H));
  });
});
