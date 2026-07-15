// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 14:29:40
 * Dependents: systems/worldforge/town/architectureStyle.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines and resolves the physical construction kits used by towns.
 *
 * A culture family owns a closed set of related wall, roof, foundation, window,
 * shutter, and ornament combinations. One district chooses a dominant kit and
 * one permitted alternative; individual buildings usually repeat the dominant
 * choice. The resolver returns pure data for architectureStyle, the town map,
 * artifacts, and the 3D bridge, with no renderer-specific decisions here.
 *
 * Called by: architectureStyle.ts and material-focused tests
 * Depends on: blueprint material contracts and frozen seed hashing
 */

import type {
  ArchitectureIdentity,
  BriefWealth,
  BuildingConstruction,
  ConstructionKitId,
  FoundationTreatment,
  GlazingType,
  OrnamentKit,
  RoofCovering,
  ShutterStyle,
  WallMaterial,
} from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';

// ============================================================================
// Family And Kit Contracts
// ============================================================================
// Family ids live here because construction kits are their physical vocabulary.
// architectureStyle reuses the same type for colors, roof forms, and facades.
// ============================================================================

export type ArchitectureFamilyId =
  | 'highlandStone'
  | 'coastalTimber'
  | 'riverHalfTimber'
  | 'roughLog'
  | 'temperateFrame';

type WealthTriplet<T> = readonly [poor: T, common: T, wealthy: T];

/** One family-approved kit before wealth and district choices are resolved. */
export interface ConstructionKitDefinition {
  id: ConstructionKitId;
  wallMaterial: WallMaterial;
  wallCourseFt: number;
  timberWidthFt: number;
  roofCovering: RoofCovering;
  foundation: FoundationTreatment;
  glazingByWealth: WealthTriplet<GlazingType>;
  shutters: readonly ShutterStyle[];
  ornamentByWealth: WealthTriplet<OrnamentKit>;
}

// ============================================================================
// Closed Family Vocabularies
// ============================================================================
// Every family has three compatible kits. The alternatives vary construction
// method enough to make streets interesting, but never cross cultural borders.
// ============================================================================

export const CONSTRUCTION_KITS: Readonly<
  Record<ArchitectureFamilyId, readonly ConstructionKitDefinition[]>
> = {
  highlandStone: [
    {
      id: 'highland-rubble-slate',
      wallMaterial: 'rubble-stone',
      wallCourseFt: 1.6,
      timberWidthFt: 0.7,
      roofCovering: 'slate',
      foundation: 'battered-stone',
      glazingByWealth: ['open-lattice', 'leaded-casement', 'clear-casement'],
      shutters: ['board-and-batten', 'paneled'],
      ornamentByWealth: ['none', 'stone-quoins', 'stone-quoins'],
    },
    {
      id: 'highland-ashlar-slate',
      wallMaterial: 'dressed-stone',
      wallCourseFt: 1.15,
      timberWidthFt: 0.55,
      roofCovering: 'slate',
      foundation: 'fieldstone',
      glazingByWealth: ['oiled-lattice', 'leaded-casement', 'clear-casement'],
      shutters: ['paneled', 'none'],
      ornamentByWealth: ['none', 'stone-quoins', 'carved-bargeboards'],
    },
    {
      id: 'highland-limewash-slab',
      wallMaterial: 'limewashed-stone',
      wallCourseFt: 1.9,
      timberWidthFt: 0.5,
      roofCovering: 'stone-slab',
      foundation: 'battered-stone',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'none'],
      ornamentByWealth: ['none', 'stone-quoins', 'carved-bargeboards'],
    },
  ],
  coastalTimber: [
    {
      id: 'coastal-weatherboard-shingle',
      wallMaterial: 'weatherboard',
      wallCourseFt: 1.05,
      timberWidthFt: 0.55,
      roofCovering: 'wood-shingle',
      foundation: 'stone-piers',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'clear-casement'],
      shutters: ['board-and-batten', 'louvered'],
      ornamentByWealth: ['none', 'rope-carving', 'carved-bargeboards'],
    },
    {
      id: 'coastal-tarred-board-shingle',
      wallMaterial: 'tarred-board',
      wallCourseFt: 1.2,
      timberWidthFt: 0.65,
      roofCovering: 'wood-shingle',
      foundation: 'timber-piles',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'none'],
      ornamentByWealth: ['none', 'rope-carving', 'rope-carving'],
    },
    {
      id: 'coastal-frame-thatch',
      wallMaterial: 'timber-plaster',
      wallCourseFt: 2.4,
      timberWidthFt: 0.75,
      roofCovering: 'reed-thatch',
      foundation: 'stone-piers',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'louvered'],
      ornamentByWealth: ['none', 'painted-timber', 'carved-bargeboards'],
    },
  ],
  riverHalfTimber: [
    {
      id: 'river-timber-tile',
      wallMaterial: 'timber-plaster',
      wallCourseFt: 2.5,
      timberWidthFt: 0.7,
      roofCovering: 'clay-tile',
      foundation: 'brick-plinth',
      glazingByWealth: ['open-lattice', 'leaded-casement', 'clear-casement'],
      shutters: ['board-and-batten', 'paneled'],
      ornamentByWealth: ['none', 'painted-timber', 'carved-bargeboards'],
    },
    {
      id: 'river-brick-tile',
      wallMaterial: 'brick-infill',
      wallCourseFt: 0.75,
      timberWidthFt: 0.55,
      roofCovering: 'clay-tile',
      foundation: 'brick-plinth',
      glazingByWealth: ['oiled-lattice', 'leaded-casement', 'clear-casement'],
      shutters: ['paneled', 'louvered'],
      ornamentByWealth: ['none', 'painted-timber', 'stone-quoins'],
    },
    {
      id: 'river-frame-shingle',
      wallMaterial: 'weatherboard',
      wallCourseFt: 1,
      timberWidthFt: 0.6,
      roofCovering: 'wood-shingle',
      foundation: 'stone-piers',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'louvered'],
      ornamentByWealth: ['none', 'painted-timber', 'carved-bargeboards'],
    },
  ],
  roughLog: [
    {
      id: 'rough-round-log-sod',
      wallMaterial: 'round-log',
      wallCourseFt: 1.25,
      timberWidthFt: 0.9,
      roofCovering: 'sod',
      foundation: 'fieldstone',
      glazingByWealth: ['open-lattice', 'open-lattice', 'oiled-lattice'],
      shutters: ['board-and-batten', 'none'],
      ornamentByWealth: ['none', 'notched-log', 'notched-log'],
    },
    {
      id: 'rough-hewn-log-shingle',
      wallMaterial: 'hewn-log',
      wallCourseFt: 1.05,
      timberWidthFt: 0.8,
      roofCovering: 'wood-shingle',
      foundation: 'fieldstone',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'none'],
      ornamentByWealth: ['none', 'notched-log', 'carved-bargeboards'],
    },
    {
      id: 'rough-pole-thatch',
      wallMaterial: 'wattle-daub',
      wallCourseFt: 2.6,
      timberWidthFt: 0.65,
      roofCovering: 'reed-thatch',
      foundation: 'timber-piles',
      glazingByWealth: ['open-lattice', 'open-lattice', 'oiled-lattice'],
      shutters: ['board-and-batten', 'none'],
      ornamentByWealth: ['none', 'notched-log', 'painted-timber'],
    },
  ],
  temperateFrame: [
    {
      id: 'temperate-frame-thatch',
      wallMaterial: 'timber-plaster',
      wallCourseFt: 2.4,
      timberWidthFt: 0.7,
      roofCovering: 'reed-thatch',
      foundation: 'fieldstone',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'leaded-casement'],
      shutters: ['board-and-batten', 'louvered'],
      ornamentByWealth: ['none', 'painted-timber', 'carved-bargeboards'],
    },
    {
      id: 'temperate-brick-tile',
      wallMaterial: 'brick-infill',
      wallCourseFt: 0.72,
      timberWidthFt: 0.55,
      roofCovering: 'clay-tile',
      foundation: 'brick-plinth',
      glazingByWealth: ['oiled-lattice', 'leaded-casement', 'clear-casement'],
      shutters: ['paneled', 'louvered'],
      ornamentByWealth: ['none', 'painted-timber', 'stone-quoins'],
    },
    {
      id: 'temperate-board-shingle',
      wallMaterial: 'weatherboard',
      wallCourseFt: 1.05,
      timberWidthFt: 0.6,
      roofCovering: 'wood-shingle',
      foundation: 'stone-piers',
      glazingByWealth: ['open-lattice', 'oiled-lattice', 'clear-casement'],
      shutters: ['board-and-batten', 'paneled'],
      ornamentByWealth: ['none', 'painted-timber', 'carved-bargeboards'],
    },
  ],
};

// ============================================================================
// Named Deterministic Resolution
// ============================================================================
// Every trait has its own readable hash label. Adding another material detail
// later cannot shift today's kit, shutter, glazing, or ornament choices.
// ============================================================================

const WEALTH_INDEX: Readonly<Record<BriefWealth, 0 | 1 | 2>> = {
  poor: 0,
  common: 1,
  wealthy: 2,
};

/** Stable zero-to-one value from an identity fact, independent of draw order. */
function textHash01(value: string): number {
  return fnv1a(value) / 0x1_0000_0000;
}

/** Pick one offered value from a named identity fact. */
function pickByText<T>(values: readonly T[], key: string): T {
  if (values.length === 0) {
    throw new Error(`resolveBuildingConstruction: no choices for ${key}`);
  }
  return values[Math.min(values.length - 1, Math.floor(textHash01(key) * values.length))];
}

/** Choose a genuine related alternative when the family offers one. */
function relatedAlternative<T>(values: readonly T[], dominant: T, key: string): T {
  const alternatives = values.filter((value) => value !== dominant);
  return alternatives.length > 0 ? pickByText(alternatives, key) : dominant;
}

/** Return a defensive copy of one family's closed kit vocabulary. */
export function constructionKitsForFamily(
  familyId: ArchitectureFamilyId,
): readonly ConstructionKitDefinition[] {
  return CONSTRUCTION_KITS[familyId];
}

/** Input shared by identified production buildings and standalone previews. */
export interface ResolveBuildingConstructionInput {
  familyId: ArchitectureFamilyId;
  wealth: BriefWealth;
  architecture?: ArchitectureIdentity;
  /** Stable style path used only when no town/district/building identity exists. */
  standaloneKey: string;
}

/**
 * Resolve one building's material kit inside its district's construction rules.
 *
 * The district owns a dominant kit, one related alternative, and a dominant
 * shutter treatment. Buildings independently repeat those answers about 78%
 * of the time. Wealth changes glazing and ornament quality inside the selected
 * kit, but never lets the building leave its culture family's vocabulary.
 */
export function resolveBuildingConstruction(
  input: ResolveBuildingConstructionInput,
): BuildingConstruction {
  const kits = CONSTRUCTION_KITS[input.familyId];
  const wealthIndex = WEALTH_INDEX[input.wealth];

  // Standalone preview buildings have no district to coordinate. They still
  // receive one deterministic complete kit so every StyleResolved is total.
  if (!input.architecture) {
    const kit = pickByText(kits, `${input.standaloneKey}|construction:kit`);
    return {
      kitId: kit.id,
      wallMaterial: kit.wallMaterial,
      wallCourseFt: kit.wallCourseFt,
      timberWidthFt: kit.timberWidthFt,
      roofCovering: kit.roofCovering,
      foundation: kit.foundation,
      glazing: kit.glazingByWealth[wealthIndex],
      shutters: pickByText(kit.shutters, `${input.standaloneKey}|construction:shutters`),
      ornamentKit: kit.ornamentByWealth[wealthIndex],
      constructionSignature: `${input.familyId}:standalone`,
    };
  }

  const districtKey = [
    input.familyId,
    input.architecture.settlementKey,
    input.architecture.districtKey,
  ].join('|');
  const buildingKey = `${districtKey}|${input.architecture.buildingKey}`;
  const dominantKit = pickByText(kits, `${districtKey}|construction:dominant`);
  const secondaryKit = relatedAlternative(
    kits,
    dominantKit,
    `${districtKey}|construction:secondary`,
  );
  const kit = textHash01(`${buildingKey}|construction:loyalty`) < 0.78
    ? dominantKit
    : secondaryKit;

  // Shutters are coordinated as their own district trait. This prevents two
  // kits with different option arrays from producing an uncontrolled mixture.
  const familyShutters = [...new Set(kits.flatMap((candidate) => candidate.shutters))];
  const dominantShutter = pickByText(
    familyShutters,
    `${districtKey}|shutters:dominant`,
  );
  const secondaryShutter = relatedAlternative(
    familyShutters,
    dominantShutter,
    `${districtKey}|shutters:secondary`,
  );
  const shutters = textHash01(`${buildingKey}|shutters:loyalty`) < 0.8
    ? dominantShutter
    : secondaryShutter;

  const signatureSource = [
    districtKey,
    dominantKit.id,
    secondaryKit.id,
    dominantShutter,
    secondaryShutter,
  ].join('|');

  return {
    kitId: kit.id,
    wallMaterial: kit.wallMaterial,
    wallCourseFt: kit.wallCourseFt,
    timberWidthFt: kit.timberWidthFt,
    roofCovering: kit.roofCovering,
    foundation: kit.foundation,
    glazing: kit.glazingByWealth[wealthIndex],
    shutters,
    ornamentKit: kit.ornamentByWealth[wealthIndex],
    constructionSignature: `${input.familyId}:${fnv1a(signatureSource).toString(36)}`,
  };
}
