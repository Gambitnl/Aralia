// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 26/08/2026, 16:53:54
 * Dependents: components/Compendium/CombatActionsTable.tsx, components/Compendium/CompendiumRuleTables.tsx, components/Compendium/ConditionTable.tsx, components/Compendium/CoverObscurementTable.tsx, components/Compendium/WeaponMasteryTable.tsx, data/glossary/combatActionsData.ts, data/glossary/conditionsData.ts, data/glossary/coverObscurementData.ts, data/glossary/index.ts, data/glossary/searchIndex.ts, data/glossary/weaponMasteryData.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/data/glossary/types.ts
 *
 * This file defines the TypeScript data shapes for the 2024 Player's Handbook (PHB)
 * structured rule reference tables.
 *
 * Why it exists:
 * The 2024 rules revision introduced streamlined, highly structured mechanics
 * for conditions, exhaustion tiers, cover bonuses, combat action economy, and
 * weapon mastery properties. Rather than forcing players and UI components to
 * parse through loose markdown text, this file provides strict, typed structures
 * that power searchable compendium views, quick-reference summary cards, and
 * deep cross-linking across the glossary.
 *
 * Connects to:
 * - Data files in src/data/glossary/ (conditionsData, coverObscurementData, combatActionsData, weaponMasteryData)
 * - Compendium UI components in src/components/Compendium/
 * - Glossary and Character Sheet tooltips
 */

// ============================================================================
// Core Rule Table Category Types
// ============================================================================
// Defines the high-level categories of rule tables available in the compendium.
// ============================================================================

export type RuleTableCategory =
  | 'conditions'
  | 'cover_obscurement'
  | 'combat_actions'
  | 'weapon_mastery';

// ============================================================================
// Condition & Exhaustion Types
// ============================================================================
// PHB 2024 defines 14 core conditions plus a reworked 6-tier Exhaustion system.
// These types model the mechanical modifiers, advantages/disadvantages, and
// saving throw interactions for every condition.
// ============================================================================

export interface ExhaustionTier {
  /** Exhaustion level number (1 through 6) */
  level: number;
  /** Penalty applied to all d20 tests (e.g. -2 for level 1, -4 for level 2, etc.) */
  d20Penalty: number;
  /** Speed reduction in feet (e.g. -5 ft for level 1, -10 ft for level 2, etc.) */
  speedReductionFeet: number;
  /** Special notes or fatal threshold (e.g. Level 6 causes death) */
  specialEffect?: string;
}

export interface ConditionRuleEntry {
  /** Unique snake_case identifier matching the glossary index (e.g. 'blinded', 'grappled') */
  id: string;
  /** Display title for the condition */
  name: string;
  /** Short one-sentence summary for quick reference cards */
  summary: string;
  /** Detailed list of mechanical effects imposed by the condition */
  effects: string[];
  /** Rules for attack rolls made by or against the affected creature */
  attackModifications?: {
    attacksAgainstHaveAdvantage?: boolean;
    attacksMadeHaveDisadvantage?: boolean;
    autoCriticalWithin5Feet?: boolean;
    details?: string;
  };
  /** Restrictions on movement (e.g. speed reduced to 0, crawl only) */
  movementRestrictions?: string;
  /** Saving throw interactions (e.g. automatic failure on Str/Dex saves) */
  savingThrowEffects?: string;
  /** Spellcasting or concentration impacts */
  spellcastingEffects?: string;
  /** Specific tiers if this entry represents Exhaustion */
  exhaustionTiers?: ExhaustionTier[];
  /** Related glossary term IDs for cross-linking */
  seeAlso?: string[];
  /** Modern PHB 2024 update highlights */
  phb2024Notes?: string;
}

// ============================================================================
// Cover and Obscurement Types
// ============================================================================
// Covers (Half, Three-Quarters, Total) and Obscurement (Lightly, Heavily)
// determine target defense, line of sight, and sensory penalties.
// ============================================================================

export type CoverOrObscurementType = 'cover' | 'obscurement';

export interface CoverObscurementEntry {
  /** Unique snake_case identifier (e.g. 'half_cover', 'heavily_obscured') */
  id: string;
  /** Display title (e.g. 'Half Cover', 'Heavily Obscured') */
  name: string;
  /** Classification: physical cover vs optical obscurement */
  type: CoverOrObscurementType;
  /** Armor Class bonus granted by this cover level (+2, +5, or null) */
  acBonus: number | null;
  /** Dexterity saving throw bonus granted by this cover level (+2, +5, or null) */
  dexSaveBonus: number | null;
  /** Targeting or line-of-sight constraints (e.g. 'Cannot be targeted directly') */
  targetingRestriction?: string;
  /** Sensory or perception penalty (e.g. 'Disadvantage on Perception checks relying on sight') */
  perceptionEffect?: string;
  /** Full descriptive explanation of the mechanic */
  description: string;
  /** Common environmental examples (low walls, arrow slits, fog, darkness) */
  examples: string[];
  /** Related glossary term IDs for cross-linking */
  seeAlso?: string[];
}

// ============================================================================
// Combat Actions Types
// ============================================================================
// Combat actions in PHB 2024 include standard actions (Attack, Dash, Dodge),
// the unified Magic action (replacing Cast a Spell), Study/Search actions,
// and opportunistic reactions.
// ============================================================================

export type ActionEconomyType =
  | 'Action'
  | 'Bonus Action'
  | 'Reaction'
  | 'Free / Movement';

export interface CombatActionEntry {
  /** Unique snake_case identifier (e.g. 'attack_action', 'magic_action', 'hide_action') */
  id: string;
  /** Display title (e.g. 'Attack', 'Magic', 'Hide') */
  name: string;
  /** Action economy bucket: Action, Bonus Action, Reaction, or Free */
  actionType: ActionEconomyType;
  /** High-level summary of what the action accomplishes */
  summary: string;
  /** Detailed step-by-step resolution rules */
  detailedRules: string[];
  /** Trigger or prerequisite required to perform this action (crucial for Reactions or Ready) */
  triggerOrPrerequisite?: string;
  /** Optional sub-options or choices available under this action (e.g. Damage, Grapple, Shove for Unarmed Strike) */
  subtypesOrOptions?: string[];
  /** Explanation of changes between 2014 and 2024 rules */
  phb2024Changes?: string;
  /** Related glossary term IDs for cross-linking */
  seeAlso?: string[];
}

// ============================================================================
// Weapon Mastery Types
// ============================================================================
// PHB 2024 Weapon Masteries grant special tactical riders to martial weapons.
// Masteries have prerequisites (Heavy, Light, Versatile, etc.) and distinct triggers.
// ============================================================================

export interface WeaponMasteryEntry {
  /** Unique identifier matching the mastery name (e.g. 'Cleave', 'Topple', 'Vex') */
  id: string;
  /** Display title for the mastery property */
  name: string;
  /** Weapon property prerequisites required to use this mastery */
  prerequisite: string;
  /** Timing trigger for the mastery rider (e.g. 'On Hit', 'On Miss', 'When attacking with Light weapon') */
  trigger: string;
  /** Full mechanical description of the effect */
  mechanic: string;
  /** Saving throw DC formula if a save is required (e.g. 'DC 8 + Str mod + Prof bonus') */
  savingThrow?: string;
  /** List of standard weapons that possess this mastery by default */
  standardWeapons: string[];
  /** Tactical tips or synergy notes for combat */
  tacticalNotes?: string;
  /** Related glossary term IDs for cross-linking */
  seeAlso?: string[];
}

// ============================================================================
// Unified Search & Query Types
// ============================================================================
// Structures used for cross-table searching and filtering in the Compendium UI.
// ============================================================================

export interface RuleSearchResult {
  /** Category of the matched rule */
  category: RuleTableCategory;
  /** Unique ID of the rule */
  id: string;
  /** Display title */
  title: string;
  /** Subtitle or badge info (e.g. 'Action Economy', 'Heavy Weapon', '+2 AC') */
  subtitle: string;
  /** Short summary snippet highlighting match relevance */
  snippet: string;
  /** Associated tags for filtering */
  tags: string[];
  /** The raw rule entry object */
  entry: ConditionRuleEntry | CoverObscurementEntry | CombatActionEntry | WeaponMasteryEntry;
}
