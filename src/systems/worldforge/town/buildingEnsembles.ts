// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:28:37
 * Dependents: systems/worldforge/town/townEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file composes individual town plots into recognizable street ensembles.
 *
 * The town generator already knows which plots share a ward edge, which wards
 * surround the market, and whether a plot sits inside a courtyard. This module
 * turns that context into durable row, court, detached, and arcade instructions
 * before any building interior generates. Per-building code stays pure and only
 * consumes the stamped instruction.
 *
 * Called by: townEngine.ts after population and collision filtering
 * Depends on: canonical town plot geometry, typology, and stable seed hashing
 */

import type {
  BuildingEnsemble,
  BuildingLotProfile,
} from '../interior/blueprintTypes';
import { fnv1a, type SeedPath } from '../seedPath';
import type {
  BuildingPlot,
  CivicStructure,
  TownTypology,
  TownWard,
} from './townEngine';
import {
  detachedCompoundProfile,
  detachedParcelProfile,
} from './detachedParcels';

/** Vertex mean is sufficient for nearest-ward ranking and avoids a runtime cycle. */
function centroid(points: readonly [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

// ============================================================================
// Group Selection
// ============================================================================
// Dense settlements use true frontage rows. Small settlements retain detached
// spacing, while the closest built wards around a plaza receive arcades.
// ============================================================================

function isDenseTypology(typology: TownTypology | undefined): boolean {
  return typology === undefined
    || typology === 'walled town'
    || typology === 'city'
    || typology === 'capital';
}

function marketWardCount(typology: TownTypology | undefined): number {
  if (typology === 'capital' || typology === 'city') return 3;
  if (typology === 'walled town' || typology === undefined) return 2;
  return 1;
}

/** Find the nearest built wards around the open plaza. */
function marketWardIndices(
  wards: readonly TownWard[],
  civic: readonly CivicStructure[],
  typology: TownTypology | undefined,
): Set<number> {
  const plaza = civic.find((structure) => structure.kind === 'plaza');
  if (!plaza) return new Set<number>();
  const center = centroid(plaza.polygon);
  return new Set(
    wards
      .map((ward, index) => ({
        index,
        ward,
        distance: Math.hypot(
          centroid(ward.polygon)[0] - center[0],
          centroid(ward.polygon)[1] - center[1],
        ),
      }))
      .filter(({ ward }) => ward.plots.some((plot) => plot.kind === 'frontage'))
      .sort((a, b) => a.distance - b.distance || a.index - b.index)
      .slice(0, marketWardCount(typology))
      .map(({ index }) => index),
  );
}

/** Group-level height creates one readable eave line without town-wide cloning. */
function eaveStoreys(
  kind: BuildingEnsemble['kind'],
  typology: TownTypology | undefined,
  blockKey: string,
): 1 | 2 | 3 {
  if (kind === 'market-arcade') {
    return typology === 'capital' && fnv1a(`${blockKey}|height`) % 3 === 0 ? 3 : 2;
  }
  if (kind === 'courtyard' || kind === 'detached') {
    return fnv1a(`${blockKey}|height`) % 4 === 0 ? 2 : 1;
  }
  if (typology === 'city' || typology === 'capital') {
    return fnv1a(`${blockKey}|height`) % 3 === 0 ? 3 : 2;
  }
  return typology === 'walled town' || typology === undefined ? 2 : 1;
}

// ============================================================================
// Party-Wall Detection
// ============================================================================
// Packed frontage polygons retain their street edge as points 0->1. Consecutive
// plots share a wall only when those endpoints truly touch after collision cuts.
// ============================================================================

function frontageTouches(left: BuildingPlot, right: BuildingPlot): boolean {
  const a = left.polygon[1];
  const b = right.polygon[0];
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-6;
}

/**
 * Choose a footprint vocabulary that respects the sides this lot must share.
 * Internal members may expose a rear court because both side runs remain full;
 * row ends put their return on the attached side. A bounded full-envelope
 * choice keeps the block from becoming a repeated row of identical notches.
 */
function lotProfileForAttachedPlot(
  leftShared: boolean,
  rightShared: boolean,
  lotKey: string,
): BuildingLotProfile {
  const choice = fnv1a(`${lotKey}|lot-profile`) % 4;
  if (choice === 0) return 'full-envelope';
  if (leftShared && rightShared) return 'rear-court';
  if (leftShared) return 'left-return';
  if (rightShared) return 'right-return';
  return choice % 2 === 0 ? 'left-return' : 'right-return';
}

/** Only stamp profiles that can survive the 5 ft blueprint grid as authored. */
function hasNegotiableEnvelope(plot: BuildingPlot): boolean {
  const width = Math.hypot(
    plot.polygon[1][0] - plot.polygon[0][0],
    plot.polygon[1][1] - plot.polygon[0][1],
  );
  const depth = Math.hypot(
    plot.polygon.at(-1)![0] - plot.polygon[0][0],
    plot.polygon.at(-1)![1] - plot.polygon[0][1],
  );
  return width >= 15 - 1e-6 && depth >= 15 - 1e-6;
}

/** Frontage width/depth in the packer's stable local frame. */
function plotEnvelopeSize(plot: BuildingPlot): { width: number; depth: number } {
  return {
    width: Math.hypot(
      plot.polygon[1][0] - plot.polygon[0][0],
      plot.polygon[1][1] - plot.polygon[0][1],
    ),
    depth: Math.hypot(
      plot.polygon.at(-1)![0] - plot.polygon[0][0],
      plot.polygon.at(-1)![1] - plot.polygon[0][1],
    ),
  };
}

/** Resolve every canonical plot to one block-level ensemble instruction. */
export function resolveBuildingEnsembles(
  wards: readonly TownWard[],
  civic: readonly CivicStructure[],
  typology: TownTypology | undefined,
  seedPath: SeedPath,
): Map<BuildingPlot, BuildingEnsemble> {
  const result = new Map<BuildingPlot, BuildingEnsemble>();
  const marketWards = marketWardIndices(wards, civic, typology);
  const dense = isDenseTypology(typology);

  wards.forEach((ward, wardIndex) => {
    // Interior infill shares identity within one court cluster, not across an
    // arbitrarily large ward. Legacy plots without an index remain court zero.
    const interiorByCourt = new Map<number, BuildingPlot[]>();
    for (const plot of ward.plots.filter((candidate) => candidate.kind === 'interior')) {
      const index = plot.courtyardIndex ?? 0;
      const group = interiorByCourt.get(index) ?? [];
      group.push(plot);
      interiorByCourt.set(index, group);
    }
    for (const [courtIndex, plots] of interiorByCourt) {
      const courtyardKey = interiorByCourt.size === 1
        ? `ward:${wardIndex}:courtyard`
        : `ward:${wardIndex}:courtyard:${courtIndex}`;
      const kind = 'courtyard' as const;
      for (const plot of plots) {
        result.set(plot, {
          blockKey: courtyardKey,
          kind,
          partyWallLeft: false,
          partyWallRight: false,
          eaveStoreys: eaveStoreys(kind, typology, courtyardKey),
          ensembleSignature: fnv1a(`${seedPath}|${courtyardKey}|${kind}`).toString(36),
        });
      }
    }

    const frontageByEdge = new Map<number, BuildingPlot[]>();
    for (const plot of ward.plots.filter((candidate) => candidate.kind !== 'interior')) {
      const group = frontageByEdge.get(plot.frontageEdge) ?? [];
      group.push(plot);
      frontageByEdge.set(plot.frontageEdge, group);
    }

    for (const [edge, plots] of frontageByEdge) {
      const blockKey = `ward:${wardIndex}:edge:${edge}`;
      const kind: BuildingEnsemble['kind'] = marketWards.has(wardIndex)
        ? 'market-arcade'
        : dense
          ? 'row'
          : 'detached';
      const sharedHeight = eaveStoreys(kind, typology, blockKey);
      // One frontage-order neighbor owns the visible masonry at every party
      // wall in this block. The opposite neighbor still keeps a tactical wall,
      // preserving its independent rooms and collision boundary.
      const partyWallOwner = fnv1a(`${seedPath}|${blockKey}|party-wall-owner`) % 2 === 0
        ? 'earlier-frontage-member' as const
        : 'later-frontage-member' as const;
      const signature = fnv1a(
        `${seedPath}|${blockKey}|${kind}|${sharedHeight}|${partyWallOwner}`,
      ).toString(36);

      plots.forEach((plot, index) => {
        const leftShared = kind !== 'detached'
          && index > 0
          && frontageTouches(plots[index - 1], plot);
        const rightShared = kind !== 'detached'
          && index < plots.length - 1
          && frontageTouches(plot, plots[index + 1]);
        const lotKey = `${seedPath}|${blockKey}|lot:${index}`;
        const districtKey = ward.architectureDistrict?.key ?? `ward:${wardIndex}`;
        const parcelProfile = kind === 'detached'
          ? detachedParcelProfile(districtKey, lotKey)
          : undefined;
        const envelope = plotEnvelopeSize(plot);
        const lotProfile = kind === 'detached'
          ? detachedCompoundProfile(
              envelope.width,
              envelope.depth,
              parcelProfile!,
              lotKey,
            )
          : !hasNegotiableEnvelope(plot)
            ? undefined
            : lotProfileForAttachedPlot(leftShared, rightShared, lotKey);
        result.set(plot, {
          blockKey,
          kind,
          partyWallLeft: leftShared,
          partyWallRight: rightShared,
          ...(kind !== 'detached' ? { partyWallOwner } : {}),
          eaveStoreys: sharedHeight,
          ...(lotProfile
            ? {
                lotProfile,
                lotSignature: fnv1a(`${lotKey}|${lotProfile}`).toString(36),
              }
            : {}),
          ...(parcelProfile
            ? {
                parcelProfile,
                parcelSignature: fnv1a(
                  `${districtKey}|${lotKey}|${parcelProfile}`,
                ).toString(36),
              }
            : {}),
          ensembleSignature: signature,
        });
      });
    }
  });

  return result;
}
