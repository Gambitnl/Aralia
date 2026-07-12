// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 14:54:48
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/architectureStyle.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file buildingMotifs.ts
 *
 * Resolves exterior type-recognition motifs without touching blueprint bones.
 * A shop should advertise itself, a smithy should vent heat, a temple should
 * interrupt the skyline, and a keep should read as defensive before a label is
 * visible. Culture adds one familiar accent, while a district chooses the
 * dominant treatment used by buildings of the same type.
 *
 * Every decision is a named hash. Adding a future motif category cannot shift
 * existing choices, and no geometry RNG stream is consumed.
 */
import type {
  BuildingMotif,
  BuildingType,
} from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';
import type { StyleFamily } from './architectureStyle';

export interface BuildingMotifProgram {
  /** Required role cues that every building of this type receives. */
  core: readonly BuildingMotif[];
  /** District-selected treatments; most siblings repeat one dominant choice. */
  districtChoices: readonly BuildingMotif[];
}

/**
 * Role grammar for every generated building type.
 *
 * Core cues carry recognition. District choices keep streets from cloning one
 * exact facade while still limiting each type to a small local vocabulary.
 */
export const BUILDING_MOTIF_PROGRAMS: Record<BuildingType, BuildingMotifProgram> = {
  cottage: { core: [], districtChoices: ['front-canopy', 'bay-window'] },
  townhouse: { core: [], districtChoices: ['bay-window', 'jettied-bay'] },
  tenement: { core: ['jettied-bay'], districtChoices: ['loading-hoist', 'covered-gallery'] },
  farmstead: { core: ['side-shed'], districtChoices: ['front-canopy', 'log-porch'] },
  shop: { core: ['hanging-sign'], districtChoices: ['shop-awning', 'display-bay'] },
  smithy: { core: ['vent-stack'], districtChoices: ['front-canopy', 'loading-hoist'] },
  workshop: { core: ['loading-hoist'], districtChoices: ['vent-stack', 'front-canopy'] },
  inn: { core: ['hanging-sign'], districtChoices: ['covered-gallery', 'entry-portico'] },
  tavern: { core: ['hanging-sign'], districtChoices: ['front-canopy', 'covered-gallery'] },
  storehouse: { core: ['loading-hoist'], districtChoices: ['front-canopy', 'side-shed'] },
  manor: { core: ['entry-portico'], districtChoices: ['corner-turrets', 'roof-finials'] },
  temple: { core: ['bell-cote'], districtChoices: ['entry-portico', 'roof-finials'] },
  keep: { core: ['battlements'], districtChoices: ['corner-turrets', 'buttresses'] },
  civic: { core: ['entry-portico'], districtChoices: ['bell-cote', 'roof-finials'] },
};

/** Culture accents stay inside the same role grammar but distinguish regions. */
const FAMILY_ACCENTS: Record<
  StyleFamily['id'],
  Partial<Record<BuildingType, BuildingMotif>>
> = {
  highlandStone: {
    manor: 'buttresses',
    temple: 'buttresses',
    keep: 'corner-turrets',
    civic: 'buttresses',
  },
  coastalTimber: {
    townhouse: 'covered-gallery',
    shop: 'covered-gallery',
    inn: 'covered-gallery',
    tavern: 'covered-gallery',
    manor: 'covered-gallery',
  },
  riverHalfTimber: {
    townhouse: 'jettied-bay',
    tenement: 'jettied-bay',
    shop: 'jettied-bay',
    inn: 'jettied-bay',
    tavern: 'jettied-bay',
  },
  roughLog: {
    cottage: 'log-porch',
    farmstead: 'log-porch',
    smithy: 'vent-stack',
    workshop: 'vent-stack',
    inn: 'log-porch',
    tavern: 'log-porch',
  },
  temperateFrame: {
    cottage: 'bay-window',
    townhouse: 'bay-window',
    shop: 'bay-window',
    manor: 'bay-window',
    civic: 'bay-window',
  },
};

export interface BuildingMotifResolution {
  motifs: BuildingMotif[];
  motifVariant: 0 | 1 | 2;
  /** Shared district/type recipe even when a minority building uses the alternate. */
  motifSignature: string;
}

/** Stable 0..1 value without consuming a generator stream. */
function hash01(value: string): number {
  return fnv1a(value) / 0x1_0000_0000;
}

/**
 * Resolve one building's role motifs inside its culture and district.
 *
 * Roughly 82% of same-type buildings repeat the district's dominant treatment;
 * the remainder use the one related alternative. Core role cues and family
 * accents never disappear, so variation cannot erase recognizability.
 */
export function resolveBuildingMotifs(
  familyId: StyleFamily['id'],
  buildingType: BuildingType,
  districtSignature: string,
  buildingVariant: string,
): BuildingMotifResolution {
  const program = BUILDING_MOTIF_PROGRAMS[buildingType];
  const districtKey = `${familyId}|${districtSignature}|${buildingType}|motifs`;
  const choiceIndex = fnv1a(`${districtKey}|dominant`) % program.districtChoices.length;
  const dominant = program.districtChoices[choiceIndex];
  const alternate = program.districtChoices.length > 1
    ? program.districtChoices[(choiceIndex + 1) % program.districtChoices.length]
    : dominant;
  const districtChoice = hash01(`${districtKey}|${buildingVariant}|loyalty`) < 0.82
    ? dominant
    : alternate;
  const familyAccent = FAMILY_ACCENTS[familyId][buildingType];

  // Set preserves the meaningful order: role cue, district treatment, culture
  // accent. Duplicates collapse when two scopes intentionally agree.
  const motifs = [...new Set([
    ...program.core,
    districtChoice,
    ...(familyAccent ? [familyAccent] : []),
  ])];
  const motifVariant = (fnv1a(`${buildingVariant}|motif-geometry`) % 3) as 0 | 1 | 2;

  return {
    motifs,
    motifVariant,
    motifSignature: `${familyId}:${fnv1a(
      `${districtKey}|${dominant}|${familyAccent ?? 'none'}`,
    ).toString(36)}`,
  };
}
