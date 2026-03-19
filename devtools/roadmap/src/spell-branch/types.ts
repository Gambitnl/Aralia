// devtools/roadmap/src/spell-branch/types.ts

/**
 * Normalized spell record for roadmap branch navigation.
 * Derived at build time from public/data/spells/**/*.json.
 * Runtime-only fields (aiContext, description, higherLevels) are excluded.
 * This is the single source of truth the axis engine reads from.
 */
export interface SpellCanonicalProfile {
  id: string;                    // slug, e.g. "magic-missile"
  name: string;                  // display name, e.g. "Magic Missile"
  level: number;                 // 0–9 (0 = cantrip)
  school: string;                // e.g. "Evocation"
  classes: string[];             // e.g. ["Wizard", "Sorcerer"]
  castingTimeUnit: CastingTimeUnit;
  concentration: boolean;
  ritual: boolean;
  components: SpellComponents;
  effectTypes: string[];         // e.g. ["DAMAGE"] or ["TERRAIN","STATUS_CONDITION"]
  targetingType: string;         // e.g. "area", "single", "self"
  attackType: string;            // "melee" | "ranged" | "" (empty string = no attack roll)
  arbitrationRequired: boolean;  // true if arbitrationType !== "mechanical"
  legacy: boolean;
}

/**
 * Normalised casting time unit for the roadmap branch navigator.
 * 'special' is a catch-all applied by the generator for any raw value
 * that is not 'action', 'bonus_action', or 'reaction' — including
 * 'minute', 'hour', 'day', and any other extended cast durations.
 * These raw values are NOT preserved in the canonical profile.
 */
export type CastingTimeUnit = 'action' | 'bonus_action' | 'reaction' | 'special';

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
}

/**
 * The seven named component combinations used by the Requirements axis.
 * Each value uniquely identifies which of the three component booleans are true.
 */
export type ComponentCombination =
  | 'verbal-only'
  | 'somatic-only'
  | 'material-only'
  | 'verbal-somatic'
  | 'verbal-material'
  | 'somatic-material'
  | 'verbal-somatic-material';

/**
 * All canonical axis identifiers. Adding a new axis later
 * requires: (1) add its id here, (2) add its extractor in axis-engine.ts.
 */
export type AxisId =
  | 'class'
  | 'level'
  | 'school'
  | 'castingTime'
  | 'effectType'
  | 'concentration'
  | 'ritual'
  | 'aiArbitration'
  | 'requirements'
  | 'targetingType'
  | 'attackType';

/**
 * A single choice made by the user during branch navigation.
 * For binary axes: value is 'yes' | 'no' | 'either'.
 * For requirements axis: value is a ComponentCombination.
 * For all other axes: value is the raw field value (e.g. "Wizard", "3", "DAMAGE").
 */
export interface AxisChoice {
  axisId: AxisId;
  value: string;
}

/**
 * A computed axis shown to the user at the current navigation step.
 * Values are derived from the live filtered spell set — nothing is hardcoded.
 */
export interface AxisState {
  axisId: AxisId;
  label: string;
  values: AxisValue[];
}

export interface AxisValue {
  value: string;
  label: string;
  count: number;   // spells matching this value in the current filtered set
}

/**
 * The full result returned by the axis engine for each navigation step.
 */
export interface AxisEngineResult {
  filteredSpells: SpellCanonicalProfile[];
  availableAxes: AxisState[];
  spellCount: number;
}
