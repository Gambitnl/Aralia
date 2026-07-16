// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 23:03:24
 * Dependents: App.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file travelAmbushBattlefield.ts
 * Projects one committed land-travel encounter onto the destination's real
 * WorldForge road instead of asking combat to invent an arena.
 *
 * World generation remains outside this pure adapter. The caller must supply a
 * complete GroundWorld built from the exact destination cell, seed, saved
 * deltas, and arrival anchor. This module then applies the same production
 * Ground -> Tactical extractor and road-framing policy used by the World Battle
 * Lab. A destination without a source road returns a source gap; it never falls
 * back to center-relative or procedural terrain.
 */
import type { BattleMapBiome, BattleMapData } from '@/types/combat';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import {
  createWorldBattleScenarioFromGround,
  type WorldBattleScenarioDiagnostics,
  type WorldBattleScenarioPreset,
} from './worldBattleScenario';

export interface TravelAmbushBattlefieldInput {
  worldSeed: number;
  destinationCellId: number;
  destinationCenterPx?: readonly [number, number];
  routeCells: readonly number[];
  hour: number;
  dimensions?: { width: number; height: number };
}

export type TravelAmbushBattlefieldResult =
  | {
      status: 'ready';
      mapData: BattleMapData;
      diagnostics: WorldBattleScenarioDiagnostics;
      sourceRouteId: string;
    }
  | {
      status: 'source-gap';
      detail: string;
      sourceRouteId: string;
    };

/** Use the source biome only for continuous tactical surface treatment. */
export function battleMapThemeForGround(ground: GroundWorld): BattleMapBiome {
  const centerX = Math.max(0, Math.floor(ground.cols / 2));
  const centerY = Math.max(0, Math.floor(ground.rows / 2));
  const biome = (ground.biomeIds[centerY * ground.cols + centerX] ?? '').toLowerCase();

  if (biome.includes('desert') || biome.includes('dune')) return 'desert';
  if (biome.includes('swamp') || biome.includes('marsh') || biome.includes('wetland')) return 'swamp';
  if (biome.includes('snow') || biome.includes('tundra') || biome.includes('glacier')) return 'snow';
  if (biome.includes('jungle') || biome.includes('rainforest')) return 'jungle';
  if (biome.includes('coast') || biome.includes('beach')) return 'coast';
  if (biome.includes('volcan') || biome.includes('lava')) return 'volcanic';
  return 'forest';
}

/** Stable travel-event lineage retained on provenance and diagnostics. */
export function travelRouteSourceId(routeCells: readonly number[]): string {
  const first = routeCells[0] ?? 'unknown';
  const last = routeCells[routeCells.length - 1] ?? 'unknown';
  return `atlas-route:${first}:${last}:cells-${routeCells.length}`;
}

/**
 * Produce a playable road ambush only when the destination GroundWorld proves
 * the exact source road needed for route-aware deployment.
 */
export function createTravelAmbushBattlefield(
  ground: GroundWorld,
  input: TravelAmbushBattlefieldInput,
): TravelAmbushBattlefieldResult {
  const sourceRouteId = travelRouteSourceId(input.routeCells);
  const preset: WorldBattleScenarioPreset = {
    id: `production-travel-ambush:${sourceRouteId}`,
    label: `Travel ambush at atlas cell ${input.destinationCellId}`,
    encounterFrame: 'Committed land-route interception',
    description: 'A production travel event projected onto the destination cell\'s nearest real WorldForge road.',
    worldSeed: input.worldSeed,
    entryCellId: input.destinationCellId,
    centerPx: input.destinationCenterPx,
    hour: input.hour,
    theme: battleMapThemeForGround(ground),
    dimensions: input.dimensions ?? { width: 80, height: 60 },
    anchorMode: 'nearest-road',
    encounterKind: 'road-ambush',
    sourceRouteQuery: `phase=world3d&ground=1&dcell=${input.destinationCellId}&wfseed=${input.worldSeed}`,
  };
  const scenario = createWorldBattleScenarioFromGround(preset, ground);

  if (scenario.mapData.encounterContext?.kind !== 'road-ambush') {
    return {
      status: 'source-gap',
      sourceRouteId,
      detail: `Travel encounter ${sourceRouteId} reached atlas cell ${input.destinationCellId}, but that GroundWorld published no traversable source road for an ambush frame.`,
    };
  }

  const provenance = scenario.mapData.provenance;
  if (!provenance || provenance.anchorCellId !== input.destinationCellId) {
    return {
      status: 'source-gap',
      sourceRouteId,
      detail: `Travel encounter ${sourceRouteId} did not preserve destination atlas cell ${input.destinationCellId} in tactical provenance.`,
    };
  }

  // Retain the committed atlas route beside the canonical generation path. It
  // explains why this place entered combat without pretending the atlas graph
  // line is the same geometric object as the local WorldForge road centerline.
  scenario.mapData.provenance = {
    ...provenance,
    generationPath: [...provenance.generationPath, `Travel event ${sourceRouteId}`],
  };

  return {
    status: 'ready',
    mapData: scenario.mapData,
    diagnostics: scenario.diagnostics,
    sourceRouteId,
  };
}
