// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 16:53:55
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file buildingMotifParts.ts
 *
 * Converts a resolved building-role motif recipe into additive 3D boxes. The
 * architecture resolver decides which cues belong to the building; this file
 * gives each cue a bounded silhouette using the building's existing wall,
 * roof, and trim palette. The shared interior bridge appends these records
 * after permanent walls, floors, doors, windows, and stairs are complete.
 *
 * Motifs intentionally use a dedicated tag and never become structural truth.
 * Rendering can show them, map/debug views can inspect them, and tactical
 * extraction can ignore them without guessing from color or dimensions.
 */
import type {
  BuildingMotif,
  BlueprintPlan,
} from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import { OUTER_THICKNESS_FT } from '../interior/walls';

/** Tag stamped on additive building-type/culture recognition geometry. */
export const MOTIF_PART_TAG = 'motif';

/**
 * The exact subset of a renderable site part that motif geometry needs.
 * This structural contract avoids a runtime cycle back into interiorParts;
 * TypeScript verifies these records can be appended to that broader part list.
 */
export interface BuildingMotifPart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  baseY?: number;
  tag: typeof MOTIF_PART_TAG;
  motifKind: BuildingMotif;
}

/** Feet-to-meters conversion shared with the production interior bridge. */
const FT = 0.3048;

/** Attach the shared motif classification to one renderable box. */
function motifPart(
  motifKind: BuildingMotif,
  box: Omit<BuildingMotifPart, 'tag' | 'motifKind'>,
): BuildingMotifPart {
  return {
    ...box,
    tag: MOTIF_PART_TAG,
    motifKind,
  };
}

/** Keep one exterior feature center inside the visible frontage. */
function clampFeatureX(xM: number, widthM: number, halfWidthM: number): number {
  const edgeClearanceM = OUTER_THICKNESS_FT * FT + 0.08;
  const limitM = Math.max(0, widthM / 2 + edgeClearanceM - halfWidthM);
  return Math.max(-limitM, Math.min(limitM, xM));
}

/**
 * Project the resolved role/culture motif recipe into deterministic site parts.
 *
 * Generated blueprints currently expose the min-Y wall as their street face,
 * so negative site-Z is the facade. Every dimension is bounded by the actual
 * blueprint envelope, which keeps the same recipe useful on cottages and large
 * civic buildings. `motifVariant` changes proportions and side placement only;
 * it cannot add or remove a district's chosen recognition vocabulary.
 */
export function buildBuildingMotifParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): BuildingMotifPart[] {
  const style = blueprint.styleResolved;
  if (!style || style.motifs.length === 0) return [];

  const widthM = blueprint.widthFt * FT;
  const depthM = blueprint.depthFt * FT;
  const origin = blueprintSiteOrigin(blueprint);
  // Motif recipes are authored around the current envelope center. Translating
  // every resulting box by this delta keeps that recipe attached to the whole
  // enlarged shell while the original core remains fixed on its town plot.
  const siteOffsetX = (blueprint.widthFt / 2 - origin.x) * FT;
  const siteOffsetZ = (blueprint.depthFt / 2 - origin.y) * FT;
  const aboveGradeStoreys = blueprint.floors.filter((floor) => floor.level >= 0).length;
  const wallTopM = Math.max(storeyHeightM, aboveGradeStoreys * storeyHeightM);
  const outerWallM = OUTER_THICKNESS_FT * FT;
  const frontFaceZ = -depthM / 2 - outerWallM;
  const rearFaceZ = depthM / 2 + outerWallM;
  const sideFaceX = widthM / 2 + outerWallM;
  const entryXM = clampFeatureX(
    ((blueprint.frontage?.entryX ?? blueprint.widthFt / 2) - blueprint.widthFt / 2) * FT,
    widthM,
    0.45,
  );
  const featureX = entryXM <= 0 ? widthM * 0.24 : -widthM * 0.24;
  const sideSign = style.motifVariant === 1 ? -1 : 1;
  const scale = 0.9 + style.motifVariant * 0.1;
  const roofRiseM = Math.max(0.25, style.pitchRiseFt * FT);
  const parts: BuildingMotifPart[] = [];

  /** Add one palette-bound motif box without repeating its classification. */
  const add = (
    motif: BuildingMotif,
    box: Omit<BuildingMotifPart, 'tag' | 'motifKind'>,
  ): void => {
    parts.push(motifPart(motif, {
      ...box,
      x: box.x + siteOffsetX,
      z: box.z + siteOffsetZ,
    }));
  };

  /**
   * Build a street-facing shelter. Shops can use only the awning slab, while
   * porches, galleries, and porticos add posts with role-specific weight.
   */
  const addFrontShelter = (
    motif: BuildingMotif,
    requestedWidthM: number,
    requestedDepthM: number,
    postCount: number,
    postWidthM: number,
    roofBaseY: number,
  ): void => {
    const shelterWidthM = Math.max(1.4, Math.min(widthM * 0.88, requestedWidthM));
    const shelterDepthM = requestedDepthM * scale;
    const centerX = clampFeatureX(entryXM, widthM, shelterWidthM / 2);
    const roofThicknessM = 0.16 + style.motifVariant * 0.03;

    add(motif, {
      x: centerX,
      z: frontFaceZ - shelterDepthM / 2,
      w: shelterWidthM,
      d: shelterDepthM,
      h: roofThicknessM,
      baseY: roofBaseY,
      colorHex: style.roofColor,
    });

    // Posts sit at the outer edge, leaving the entry plane and its door leaf
    // unobstructed. A three-post gallery gains a central rhythm but collision
    // still treats all of this as presentation dressing.
    for (let index = 0; index < postCount; index += 1) {
      const fraction = postCount === 1 ? 0 : index / (postCount - 1) - 0.5;
      add(motif, {
        x: centerX + fraction * (shelterWidthM - postWidthM),
        z: frontFaceZ - shelterDepthM * 0.86,
        w: postWidthM,
        d: postWidthM,
        h: roofBaseY,
        colorHex: style.trimColor,
      });
    }
  };

  // Each motif is deliberately made from a few strong silhouettes rather than
  // dense ornament. This remains legible in a full town and keeps production
  // geometry bounded even when hundreds of buildings are visible.
  for (const motif of style.motifs) {
    switch (motif) {
      case 'front-canopy': {
        addFrontShelter(motif, Math.min(3.2, widthM * 0.5), 1.15, 2, 0.13, 2.25);
        break;
      }
      case 'shop-awning': {
        addFrontShelter(motif, Math.min(3.8, widthM * 0.64), 1.0, 0, 0.1, 2.2);
        break;
      }
      case 'display-bay':
      case 'bay-window': {
        const bayWidthM = Math.min(1.75, Math.max(1.15, widthM * 0.27)) * scale;
        const bayDepthM = (motif === 'display-bay' ? 0.68 : 0.52) * scale;
        const centerX = clampFeatureX(featureX, widthM, bayWidthM / 2);
        const baseY = motif === 'display-bay' ? 0.45 : 0.85;
        const heightM = motif === 'display-bay' ? 1.65 : 1.4;

        add(motif, {
          x: centerX,
          z: frontFaceZ - bayDepthM / 2,
          w: bayWidthM,
          d: bayDepthM,
          h: heightM,
          baseY,
          colorHex: style.wallColor,
        });
        add(motif, {
          x: centerX,
          z: frontFaceZ - bayDepthM / 2,
          w: bayWidthM + 0.16,
          d: bayDepthM + 0.12,
          h: 0.14,
          baseY: baseY + heightM,
          colorHex: style.trimColor,
        });
        break;
      }
      case 'jettied-bay': {
        const bayWidthM = Math.min(3.4, Math.max(1.8, widthM * 0.48)) * scale;
        const bayDepthM = 0.62 * scale;
        const baseY = aboveGradeStoreys > 1
          ? Math.max(2.35, wallTopM - storeyHeightM)
          : Math.max(0.9, storeyHeightM * 0.34);
        const heightM = Math.max(1.25, Math.min(2.25, wallTopM - baseY - 0.12));

        add(motif, {
          x: clampFeatureX(featureX, widthM, bayWidthM / 2),
          z: frontFaceZ - bayDepthM / 2,
          w: bayWidthM,
          d: bayDepthM,
          h: heightM,
          baseY,
          colorHex: style.wallColor,
        });
        add(motif, {
          x: clampFeatureX(featureX, widthM, bayWidthM / 2),
          z: frontFaceZ - bayDepthM * 0.72,
          w: bayWidthM + 0.2,
          d: 0.18,
          h: 0.2,
          baseY: Math.max(0.15, baseY - 0.2),
          colorHex: style.trimColor,
        });
        break;
      }
      case 'hanging-sign': {
        const signSide = entryXM <= 0 ? 1 : -1;
        const signX = clampFeatureX(entryXM + signSide * 0.85, widthM, 0.34);
        const bracketDepthM = 0.7 + style.motifVariant * 0.12;

        add(motif, {
          x: signX,
          z: frontFaceZ - bracketDepthM / 2,
          w: 0.12,
          d: bracketDepthM,
          h: 0.12,
          baseY: 2.48,
          colorHex: style.trimColor,
        });
        add(motif, {
          x: signX,
          z: frontFaceZ - bracketDepthM * 0.82,
          w: 0.68 * scale,
          d: 0.14,
          h: 0.65 + style.motifVariant * 0.08,
          baseY: 1.78,
          colorHex: style.roofColor,
        });
        break;
      }
      case 'vent-stack': {
        const stackSizeM = 0.48 + style.motifVariant * 0.08;
        add(motif, {
          x: clampFeatureX(sideSign * widthM * 0.28, widthM, stackSizeM / 2),
          z: depthM * 0.16,
          w: stackSizeM,
          d: stackSizeM,
          h: 1.7 + style.motifVariant * 0.32,
          baseY: Math.max(storeyHeightM * 0.72, wallTopM - 0.5),
          colorHex: style.trimColor,
        });
        break;
      }
      case 'loading-hoist': {
        const hoistX = clampFeatureX(featureX, widthM, 0.2);
        const beamBaseY = Math.min(wallTopM - 0.25, Math.max(2.75, wallTopM * 0.7));
        const reachM = 1.0 + style.motifVariant * 0.18;

        add(motif, {
          x: hoistX,
          z: frontFaceZ - 0.08,
          w: 0.16,
          d: 0.16,
          h: 1.45,
          baseY: Math.max(1.2, beamBaseY - 1.45),
          colorHex: style.trimColor,
        });
        add(motif, {
          x: hoistX,
          z: frontFaceZ - reachM / 2,
          w: 0.16,
          d: reachM,
          h: 0.16,
          baseY: beamBaseY,
          colorHex: style.trimColor,
        });
        add(motif, {
          x: hoistX,
          z: frontFaceZ - reachM * 0.9,
          w: 0.1,
          d: 0.1,
          h: 0.72,
          baseY: beamBaseY - 0.68,
          colorHex: style.roofColor,
        });
        break;
      }
      case 'side-shed': {
        const shedWidthM = Math.min(1.9, Math.max(1.2, widthM * 0.24)) * scale;
        const shedDepthM = Math.min(3.2, Math.max(1.8, depthM * 0.48));
        const shedHeightM = Math.min(2.4, Math.max(1.75, storeyHeightM * 0.68));
        const shedX = sideSign * (sideFaceX + shedWidthM / 2);
        const shedZ = Math.min(rearFaceZ - shedDepthM / 2, depthM * 0.15);

        add(motif, {
          x: shedX,
          z: shedZ,
          w: shedWidthM,
          d: shedDepthM,
          h: shedHeightM,
          colorHex: style.wallColor,
        });
        add(motif, {
          x: shedX,
          z: shedZ,
          w: shedWidthM + 0.18,
          d: shedDepthM + 0.18,
          h: 0.18,
          baseY: shedHeightM,
          colorHex: style.roofColor,
        });
        break;
      }
      case 'covered-gallery': {
        addFrontShelter(motif, widthM * 0.78, 1.3, 3, 0.13, 2.3);
        break;
      }
      case 'entry-portico': {
        addFrontShelter(motif, Math.min(3.3, widthM * 0.52), 1.45, 2, 0.22, 2.65);
        break;
      }
      case 'bell-cote': {
        const baseY = wallTopM + roofRiseM * 0.45;
        const halfGapM = 0.42 + style.motifVariant * 0.06;
        for (const x of [-halfGapM, halfGapM]) {
          add(motif, {
            x,
            z: 0,
            w: 0.2,
            d: 0.34,
            h: 1.35 + style.motifVariant * 0.15,
            baseY,
            colorHex: style.trimColor,
          });
        }
        add(motif, {
          x: 0,
          z: 0,
          w: halfGapM * 2 + 0.38,
          d: 0.52,
          h: 0.2,
          baseY: baseY + 1.32 + style.motifVariant * 0.15,
          colorHex: style.roofColor,
        });
        break;
      }
      case 'roof-finials': {
        const baseY = wallTopM + roofRiseM * 0.78;
        const spreadM = Math.min(widthM * 0.3, 2.4);
        for (const x of [-spreadM, spreadM]) {
          add(motif, {
            x,
            z: 0,
            w: 0.18,
            d: 0.18,
            h: 0.55 + style.motifVariant * 0.12,
            baseY,
            colorHex: style.trimColor,
          });
        }
        break;
      }
      case 'battlements': {
        const merlonCount = Math.max(5, Math.min(9, Math.round(widthM / 1.1)));
        const merlonWidthM = Math.min(0.72, widthM / (merlonCount * 1.5));
        for (const z of [frontFaceZ + outerWallM / 2, rearFaceZ - outerWallM / 2]) {
          for (let index = 0; index < merlonCount; index += 1) {
            const x = -widthM / 2 + ((index + 0.5) / merlonCount) * widthM;
            add(motif, {
              x,
              z,
              w: merlonWidthM,
              d: 0.42,
              h: 0.72 + style.motifVariant * 0.12,
              baseY: wallTopM,
              colorHex: style.wallColor,
            });
          }
        }
        break;
      }
      case 'corner-turrets': {
        const turretSizeM = Math.min(1.25, Math.max(0.82, widthM * 0.14)) * scale;
        const turretHeightM = wallTopM + 0.55 + style.motifVariant * 0.2;
        for (const xSign of [-1, 1]) {
          for (const zSign of [-1, 1]) {
            const x = xSign * (sideFaceX + turretSizeM * 0.24);
            const z = zSign * (depthM / 2 + outerWallM + turretSizeM * 0.24);
            add(motif, {
              x,
              z,
              w: turretSizeM,
              d: turretSizeM,
              h: turretHeightM,
              colorHex: style.wallColor,
            });
            add(motif, {
              x,
              z,
              w: turretSizeM + 0.16,
              d: turretSizeM + 0.16,
              h: 0.18,
              baseY: turretHeightM,
              colorHex: style.roofColor,
            });
          }
        }
        break;
      }
      case 'buttresses': {
        const buttressWidthM = 0.42 + style.motifVariant * 0.08;
        const buttressDepthM = 0.62 + style.motifVariant * 0.1;
        const buttressHeightM = Math.max(1.8, wallTopM * 0.68);
        const cornerInsetM = Math.min(widthM * 0.32, widthM / 2 - buttressWidthM);
        for (const x of [-cornerInsetM, cornerInsetM]) {
          for (const zSign of [-1, 1]) {
            add(motif, {
              x,
              z: zSign < 0
                ? frontFaceZ - buttressDepthM / 2
                : rearFaceZ + buttressDepthM / 2,
              w: buttressWidthM,
              d: buttressDepthM,
              h: buttressHeightM,
              colorHex: style.trimColor,
            });
          }
        }
        break;
      }
      case 'log-porch': {
        addFrontShelter(motif, Math.min(4.4, widthM * 0.72), 1.45, 3, 0.24, 2.18);
        break;
      }
      default: {
        // Exhaustive on purpose: a newly introduced motif must receive an
        // explicit visible form instead of silently disappearing in 3D.
        const unrenderedMotif: never = motif;
        return unrenderedMotif;
      }
    }
  }

  return parts;
}
