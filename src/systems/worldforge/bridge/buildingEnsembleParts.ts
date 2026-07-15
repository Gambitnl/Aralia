// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 20:03:49
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a town-authored building ensemble into restrained 3D cues.
 *
 * Rows receive a continuous-height eave band, while market arcades also gain
 * a shallow street canopy and bounded supporting columns. These boxes are
 * presentation-only: the blueprint remains the source of truth for walls,
 * doors, windows, collision, and navigation.
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan ensemble metadata and its canonical site origin
 */

import type { BlueprintPlan } from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';

// ============================================================================
// Public Render Contract
// ============================================================================

export const ENSEMBLE_PART_TAG = 'building-ensemble';

export type EnsembleDetailKind =
  | 'shared-eave-band'
  | 'arcade-canopy'
  | 'arcade-column';

export interface BuildingEnsemblePart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  baseY: number;
  colorHex: string;
  tag: typeof ENSEMBLE_PART_TAG;
  ensembleDetailKind: EnsembleDetailKind;
}

const FT = 0.3048;
const EAVE_BAND_DEPTH_FT = 0.28;
const EAVE_BAND_HEIGHT_FT = 0.24;
const CANOPY_DEPTH_FT = 4;
const CANOPY_HEIGHT_FT = 0.35;
const CANOPY_BASE_FT = 7;
const COLUMN_WIDTH_FT = 0.42;
const MAX_COLUMN_SPACING_FT = 8;

function part(
  kind: EnsembleDetailKind,
  xFt: number,
  zFt: number,
  widthFt: number,
  depthFt: number,
  heightFt: number,
  baseYFt: number,
  colorHex: string,
): BuildingEnsemblePart {
  return {
    x: xFt * FT,
    z: zFt * FT,
    w: widthFt * FT,
    d: depthFt * FT,
    h: heightFt * FT,
    baseY: baseYFt * FT,
    colorHex,
    tag: ENSEMBLE_PART_TAG,
    ensembleDetailKind: kind,
  };
}

// ============================================================================
// Public Projection
// ============================================================================

/** Build bounded visual evidence of a row or market-arcade contract. */
export function buildBuildingEnsembleParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): BuildingEnsemblePart[] {
  const ensemble = blueprint.ensemble;
  if (!ensemble || (ensemble.kind !== 'row' && ensemble.kind !== 'market-arcade')) {
    return [];
  }

  const origin = blueprintSiteOrigin(blueprint);
  const frontageCenterFt = blueprint.widthFt / 2 - origin.x;
  const frontageZFt = -origin.y;
  const trim = blueprint.styleResolved?.trimColor ?? '#6b4a30';
  const storeyHeightFt = storeyHeightM / FT;
  const parts: BuildingEnsemblePart[] = [
    part(
      'shared-eave-band',
      frontageCenterFt,
      frontageZFt - EAVE_BAND_DEPTH_FT / 2,
      blueprint.widthFt,
      EAVE_BAND_DEPTH_FT,
      EAVE_BAND_HEIGHT_FT,
      ensemble.eaveStoreys * storeyHeightFt - EAVE_BAND_HEIGHT_FT,
      trim,
    ),
  ];

  if (ensemble.kind !== 'market-arcade') return parts;

  parts.push(part(
    'arcade-canopy',
    frontageCenterFt,
    frontageZFt - CANOPY_DEPTH_FT / 2,
    blueprint.widthFt,
    CANOPY_DEPTH_FT,
    CANOPY_HEIGHT_FT,
    CANOPY_BASE_FT,
    trim,
  ));

  // Include both ends and enough intermediate supports to keep every clear
  // span under the spacing cap, without allowing detail count to grow freely.
  const spans = Math.max(1, Math.min(8, Math.ceil(blueprint.widthFt / MAX_COLUMN_SPACING_FT)));
  for (let index = 0; index <= spans; index++) {
    const xFt = -origin.x + blueprint.widthFt * (index / spans);
    parts.push(part(
      'arcade-column',
      xFt,
      frontageZFt - CANOPY_DEPTH_FT + COLUMN_WIDTH_FT / 2,
      COLUMN_WIDTH_FT,
      COLUMN_WIDTH_FT,
      CANOPY_BASE_FT,
      0,
      trim,
    ));
  }

  return parts;
}
