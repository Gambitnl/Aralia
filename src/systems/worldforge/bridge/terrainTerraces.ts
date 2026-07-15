// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:40:11
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file terrainTerraces.ts - negotiates coherent terrain pads for attached rows.
 *
 * The terrain bridge knows actual relief while the town plan knows which
 * buildings belong together. This pure resolver joins those facts without
 * changing either source: viable rows step by one storey, and steep or
 * ungrouped buildings retain their exact sampled centroid height.
 */
import { WORLD3D_CONFIG } from '../../world3d/config';
import { fnv1a } from '../seedPath';
import type { BuildingEnsembleKind } from '../interior/blueprintTypes';

/** One architectural storey is the readable terrace increment. */
export const TERRACE_STEP_M = 3;
export const TERRACE_STEP_ENCODED = (
  TERRACE_STEP_M
  * 100
  / (WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M * WORLD3D_CONFIG.VERTICAL_EXAGGERATION)
);

export interface TerrainPadCandidate {
  id: string;
  rawHeightEncoded: number;
  order: number;
  blockKey?: string;
  ensembleKind?: BuildingEnsembleKind;
}

export interface TerrainTerraceReceipt {
  blockKey: string;
  /** Signed storey step relative to the block's first frontage member. */
  stepIndex: number;
  padHeightEncoded: number;
  terraceSignature: string;
}

export interface TerrainPadResolution {
  padHeightEncoded: number;
  terrace?: TerrainTerraceReceipt;
}

function isTerraceKind(kind: BuildingEnsembleKind | undefined): boolean {
  return kind === 'row' || kind === 'market-arcade';
}

/**
 * Resolve attached groups transactionally. A row is negotiated only when it
 * has several members and no raw neighbor jump exceeds two storeys; otherwise
 * every member keeps the historical centroid pad exactly.
 */
export function resolveTerrainTerraces(
  candidates: readonly TerrainPadCandidate[],
): Map<string, TerrainPadResolution> {
  const result = new Map<string, TerrainPadResolution>();
  const groups = new Map<string, TerrainPadCandidate[]>();
  for (const candidate of candidates) {
    result.set(candidate.id, { padHeightEncoded: candidate.rawHeightEncoded });
    if (!candidate.blockKey || !isTerraceKind(candidate.ensembleKind)) continue;
    const group = groups.get(candidate.blockKey) ?? [];
    group.push(candidate);
    groups.set(candidate.blockKey, group);
  }

  for (const [blockKey, unsorted] of groups) {
    const group = [...unsorted].sort((a, b) => a.order - b.order);
    if (group.length < 2) continue;
    const viable = group.slice(1).every((candidate, index) =>
      Math.abs(candidate.rawHeightEncoded - group[index].rawHeightEncoded)
        <= TERRACE_STEP_ENCODED * 2 + 1e-9);
    if (!viable) continue;

    const anchor = group[0].rawHeightEncoded;
    let previousStep = 0;
    for (const [index, candidate] of group.entries()) {
      const desired = Math.round(
        (candidate.rawHeightEncoded - anchor) / TERRACE_STEP_ENCODED,
      );
      const stepIndex = index === 0
        ? 0
        : Math.max(previousStep - 1, Math.min(previousStep + 1, desired));
      previousStep = stepIndex;
      const padHeightEncoded = anchor + stepIndex * TERRACE_STEP_ENCODED;
      result.set(candidate.id, {
        padHeightEncoded,
        terrace: {
          blockKey,
          stepIndex,
          padHeightEncoded,
          terraceSignature: fnv1a(
            `${blockKey}|${anchor.toFixed(9)}|${stepIndex}`,
          ).toString(36),
        },
      });
    }
  }

  return result;
}
