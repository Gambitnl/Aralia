// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 18:49:54
 * Dependents: systems/worldforge/interior/generateBuilding.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/types.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file buildingExtensions.ts
 *
 * Replays explicit structural extension outcomes into the canonical footprint.
 * This happens before partitioning so rooms, walls, stairs, and roofs all agree
 * that the new mass is real architecture rather than renderer-only dressing.
 */
import type {
  BlueprintPlan,
  BuildingEvent,
  BuildingEventHistory,
  StyleResolved,
} from './blueprintTypes';
import { fnv1a } from '../seedPath';
import type { Feet } from '../units';
import type { Footprint, FootprintMass } from './footprint';
import { structuralBuildingHistoryEvents } from './buildingEventHistory';

// ============================================================================
// Public Result And Grid Contract
// ============================================================================
// Extensions use the same five-foot cells as every canonical blueprint. The
// optional origin is the only extra coordinate fact renderers need.
// ============================================================================

const CELL_FT = 5;

export interface StructuralExtensionResult {
  footprint: Footprint;
  /** Present only when normalization moved the original footprint's center. */
  siteOriginFt?: { x: Feet; y: Feet };
}

/** One prevalidated addition a living-town event may persist later. */
export interface PlannedBuildingExtension {
  mass: Pick<FootprintMass, 'kind' | 'x' | 'y' | 'w' | 'h'>;
  phase: number;
  /** Roof grammar that set the addition's proportions, retained as evidence. */
  roofForm: StyleResolved['roofForm'];
}

// ============================================================================
// Stored-Outcome Validation
// ============================================================================
// Saved rectangles are trusted as outcomes, not as instructions. These guards
// still reject malformed or physically disconnected architecture loudly.
// ============================================================================

/** Validate a stored rectangle before allowing it to alter canonical geometry. */
function assertMass(mass: FootprintMass, eventIndex: number): void {
  if (mass.kind !== 'wing' && mass.kind !== 'tower') {
    throw new Error(`applyStructuralExtensions: event ${eventIndex} must add a wing or tower`);
  }
  for (const [label, value] of Object.entries({ x: mass.x, y: mass.y, w: mass.w, h: mass.h })) {
    if (!Number.isInteger(value)) {
      throw new Error(`applyStructuralExtensions: event ${eventIndex} ${label} must be an integer`);
    }
  }
  if (mass.w <= 0 || mass.h <= 0) {
    throw new Error(`applyStructuralExtensions: event ${eventIndex} has an empty mass`);
  }
}

/** A new rectangle must physically join the building instead of creating an outbuilding. */
function touchesOccupied(mass: FootprintMass, occupied: ReadonlySet<string>): boolean {
  for (let y = mass.y; y < mass.y + mass.h; y += 1) {
    for (let x = mass.x; x < mass.x + mass.w; x += 1) {
      if (occupied.has(`${x},${y}`)
        || occupied.has(`${x - 1},${y}`)
        || occupied.has(`${x + 1},${y}`)
        || occupied.has(`${x},${y - 1}`)
        || occupied.has(`${x},${y + 1}`)) return true;
    }
  }
  return false;
}

// ============================================================================
// Canonical Structural Replay
// ============================================================================
// The full event sequence is applied in the original frame and normalized once
// at the end, preventing earlier additions from changing later saved targets.
// ============================================================================

/**
 * Apply every structural extension in chronological log order. Coordinates in
 * event payloads stay in the original footprint frame, making save replay
 * independent of normalization introduced by earlier additions.
 */
export function applyStructuralExtensions(
  base: Footprint,
  history: BuildingEventHistory | readonly BuildingEvent[] | undefined,
  limits: { maxWidthFt?: number; maxDepthFt?: number } = {},
): StructuralExtensionResult {
  // Compacted prefixes retain structural outcomes with absolute ordinals, so
  // mass identity remains stable even though non-structural events were folded.
  const structural = structuralBuildingHistoryEvents(history).map(({ event, eventIndex }) => ({
    mass: event.payload.mass!,
    eventIndex,
  }));
  if (structural.length === 0) return { footprint: base };

  // Work in the stable base frame until all events have been validated. Only
  // the final result is normalized for the existing partition and roof code.
  const occupied = new Set(base.cells.map((cell) => `${cell.cx},${cell.cy}`));
  const masses: FootprintMass[] = base.masses.map((mass) => ({ ...mass }));
  for (const { mass: storedMass, eventIndex } of structural) {
    const mass: FootprintMass = { ...storedMass, extensionEventIndex: eventIndex };
    assertMass(mass, eventIndex);
    if (!touchesOccupied(mass, occupied)) {
      throw new Error(`applyStructuralExtensions: event ${eventIndex} is disconnected`);
    }
    let added = 0;
    for (let y = mass.y; y < mass.y + mass.h; y += 1) {
      for (let x = mass.x; x < mass.x + mass.w; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) added += 1;
        occupied.add(key);
      }
    }
    if (added === 0) {
      throw new Error(`applyStructuralExtensions: event ${eventIndex} adds no footprint cells`);
    }
    masses.push(mass);
  }

  const coordinates = [...occupied].map((key) => key.split(',').map(Number) as [number, number]);
  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  // Lot caps are centered on the original building site, not on the enlarged
  // envelope. This catches a one-sided overhang that a width-only check misses.
  const leftFt = minX * CELL_FT - base.cols * CELL_FT / 2;
  const rightFt = (maxX + 1) * CELL_FT - base.cols * CELL_FT / 2;
  const frontFt = minY * CELL_FT - base.rows * CELL_FT / 2;
  const rearFt = (maxY + 1) * CELL_FT - base.rows * CELL_FT / 2;
  if (limits.maxWidthFt !== undefined
    && (leftFt < -limits.maxWidthFt / 2 || rightFt > limits.maxWidthFt / 2)) {
    throw new Error(`applyStructuralExtensions: extension exceeds the lot width`);
  }
  if (limits.maxDepthFt !== undefined
    && (frontFt < -limits.maxDepthFt / 2 || rearFt > limits.maxDepthFt / 2)) {
    throw new Error(`applyStructuralExtensions: extension exceeds the lot depth`);
  }

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const occ = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (const [x, y] of coordinates) occ[y - minY][x - minX] = true;
  const cells = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (occ[y][x]) cells.push({ cx: x, cy: y });
    }
  }
  return {
    footprint: {
      cols,
      rows,
      occ,
      cells,
      masses: masses.map((mass) => ({ ...mass, x: mass.x - minX, y: mass.y - minY })),
    },
    siteOriginFt: {
      x: (base.cols / 2 - minX) * CELL_FT,
      y: (base.rows / 2 - minY) * CELL_FT,
    },
  };
}

// ============================================================================
// District-Aware Candidate Planning
// ============================================================================
// A town registers a small sequence of valid future additions while it still
// has canonical lot geometry. The simulation later selects these stored
// outcomes without knowing about rooms or consuming its life-event RNG.
// ============================================================================

export interface PlanBuildingExtensionsOptions {
  maxWidthFt?: number;
  maxDepthFt?: number;
  roofForm?: StyleResolved['roofForm'];
  /** Stable district identity keeps proportions coherent across neighboring buildings. */
  districtKey?: string;
  maxCandidates?: number;
}

/** Turn a generated plan back into the footprint contract used by validation. */
function footprintFromPlan(plan: BlueprintPlan): Footprint {
  const cols = plan.widthFt / CELL_FT;
  const rows = plan.depthFt / CELL_FT;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
    throw new Error(`planBuildingExtensionCandidates: plan dimensions must be 5ft aligned`);
  }
  const occ = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (const cell of plan.footprintCells) occ[cell.cy][cell.cx] = true;
  return {
    cols,
    rows,
    occ,
    cells: plan.footprintCells.map((cell) => ({ ...cell })),
    masses: plan.masses.map((mass) => ({ ...mass })),
  };
}

/** Clamp an along-wall run so even small buildings receive a centered proposal. */
function centeredStart(span: number, run: number): number {
  return Math.max(0, Math.floor((span - Math.min(span, run)) / 2));
}

/**
 * Plan up to two cumulative additions whose dimensions speak the district's
 * roof language. Orientation comes from building identity, so neighboring
 * buildings share proportions without becoming mirrored clones.
 */
export function planBuildingExtensionCandidates(
  plan: BlueprintPlan,
  options: PlanBuildingExtensionsOptions = {},
): PlannedBuildingExtension[] {
  if (plan.siteOriginFt) {
    throw new Error(`planBuildingExtensionCandidates: expected an unextended base plan`);
  }
  const base = footprintFromPlan(plan);
  const roofForm = options.roofForm ?? plan.styleResolved?.roofForm ?? 'gable';
  const preferredAlong = roofForm === 'flat' ? 4 : roofForm === 'hip' ? 3 : roofForm === 'steep' ? 2 : 3;
  const preferredOutward = roofForm === 'hip' ? 2 : 1;

  // The district fixes shape vocabulary; the individual building hash rotates
  // that vocabulary around its shell and therefore retains visible variety.
  const identity = `${options.districtKey ?? plan.styleResolved?.districtSignature ?? ''}|${plan.buildingId}`;
  const sides = ['east', 'south', 'west', 'north'] as const;
  const startSide = fnv1a(`${identity}|extension-side`) % sides.length;
  const orderedSides = sides.map((_, index) => sides[(startSide + index) % sides.length]);
  const accepted: PlannedBuildingExtension[] = [];
  const events: BuildingEvent[] = [];
  const maxCandidates = Math.max(0, Math.min(4, options.maxCandidates ?? 2));

  for (const side of orderedSides) {
    if (accepted.length >= maxCandidates) break;
    // Try the district's preferred silhouette first, then a compact form when
    // the lot cannot hold the full expression. Both retain the roof grammar.
    const sizes = [
      { along: preferredAlong, outward: preferredOutward },
      { along: Math.min(2, preferredAlong), outward: 1 },
    ];
    for (const size of sizes) {
      const alongX = Math.min(base.cols, size.along);
      const alongY = Math.min(base.rows, size.along);
      const bounds = side === 'east'
        ? { x: base.cols - 1, y: centeredStart(base.rows, alongY), w: size.outward + 1, h: alongY }
        : side === 'west'
          ? { x: -size.outward, y: centeredStart(base.rows, alongY), w: size.outward + 1, h: alongY }
          : side === 'south'
            ? { x: centeredStart(base.cols, alongX), y: base.rows - 1, w: alongX, h: size.outward + 1 }
            : { x: centeredStart(base.cols, alongX), y: -size.outward, w: alongX, h: size.outward + 1 };
      // Hip districts may use a square tower cap; compact or rectangular
      // fallbacks remain wings so the roof solver never receives a false tower.
      const mass: PlannedBuildingExtension['mass'] = {
        kind: roofForm === 'hip' && bounds.w === bounds.h ? 'tower' : 'wing',
        ...bounds,
      };
      const event: BuildingEvent = {
        day: events.length + 1,
        kind: 'extension',
        payload: { phase: accepted.length + 1, mass },
      };
      try {
        applyStructuralExtensions(base, [...events, event], options);
      } catch {
        continue;
      }
      accepted.push({ mass, phase: accepted.length + 1, roofForm });
      events.push(event);
      break;
    }
  }

  // Tight medieval plots often leave no exterior setback at all, but their
  // irregular footprints still contain buildable notches. Treat enclosing one
  // of those attached bays as an extension before giving up on the lot.
  const infillShapes = roofForm === 'hip'
    ? [[2, 2], [1, 1]]
    : roofForm === 'flat'
      ? [[3, 1], [1, 3], [2, 1], [1, 2], [1, 1]]
      : roofForm === 'steep'
        ? [[1, 2], [2, 1], [1, 1]]
        : [[2, 1], [1, 2], [1, 1]];
  const infillMasses: PlannedBuildingExtension['mass'][] = [];
  for (const [w, h] of infillShapes) {
    if (w > base.cols || h > base.rows) continue;
    for (let y = 0; y <= base.rows - h; y += 1) {
      for (let x = 0; x <= base.cols - w; x += 1) {
        const addsCell = Array.from({ length: h }, (_, dy) =>
          Array.from({ length: w }, (_, dx) => !base.occ[y + dy][x + dx])).flat().some(Boolean);
        if (!addsCell) continue;
        infillMasses.push({
          kind: roofForm === 'hip' && w === h ? 'tower' : 'wing',
          x,
          y,
          w,
          h,
        });
      }
    }
  }
  infillMasses.sort((a, b) =>
    fnv1a(`${identity}|infill:${a.x}:${a.y}:${a.w}:${a.h}`)
      - fnv1a(`${identity}|infill:${b.x}:${b.y}:${b.w}:${b.h}`)
      || a.y - b.y || a.x - b.x || a.w - b.w || a.h - b.h);
  for (const mass of infillMasses) {
    if (accepted.length >= maxCandidates) break;
    const event: BuildingEvent = {
      day: events.length + 1,
      kind: 'extension',
      payload: { phase: accepted.length + 1, mass },
    };
    try {
      applyStructuralExtensions(base, [...events, event], options);
    } catch {
      continue;
    }
    accepted.push({ mass, phase: accepted.length + 1, roofForm });
    events.push(event);
  }
  return accepted;
}
