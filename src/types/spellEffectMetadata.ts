// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/06/2026, 12:11:49
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes metadata that coordinates spell effects without replacing
 * the effects themselves.
 *
 * It exists because some spells need an extra machine-readable layer above
 * `effects[]`: either a menu where the caster chooses one operation, or a turn
 * schedule where different effect packets happen at different times. Keeping
 * those coordination contracts here prevents `spells.ts` from absorbing every
 * new mechanics-discovery shape while preserving the same public exports.
 *
 * Called by: `spells.ts` for the public spell contract.
 * Depends on: no other type modules, so this split stays behavior-preserving.
 */

//==============================================================================
// Scheduled Effect Metadata
//==============================================================================
// These types track spells whose effects change over later turns or phases.
// The actual damage, save, terrain, or control payloads remain in `effects[]`;
// this layer only records when those payloads occur and how they target.
//==============================================================================

/** Describes the target rule for one scheduled effect stage. */
export interface EffectScheduleTargeting {
  /** Fixed count such as six lightning bolts, or all valid targets in the area. */
  count: number | "all";
  /** What categories can be selected or affected during this schedule entry. */
  validTargets: "creatures" | "objects" | "creature_or_object";
  /** Who chooses the targets when the entry does not simply affect everyone. */
  selection: "caster_choice" | "all_valid_targets";
  /** True when selected targets must be distinct from each other. */
  mustBeDifferent?: boolean;
  /** Short prose note for edge cases the current target fields do not cover. */
  notes?: string;
}

/** One turn- or phase-bound stage in a spell's changing effect schedule. */
export interface EffectScheduleEntry {
  /** Human-facing stage name, usually matching canonical turn text. */
  label: string;
  /** Trigger timing for this stage. */
  timing: "caster_turn_start";
  /** First caster turn number where this stage applies. */
  turnStart: number;
  /** Last caster turn number where this stage applies. Omit when it is one turn only. */
  turnEnd?: number;
  /** Runtime effect array indexes that implement this stage's actual mechanics. */
  effectIndices?: number[];
  /** Broad effect families used by this stage, kept for quick audit/review. */
  effectTypes: string[];
  /** Target-count and distinct-target rules for this stage, when relevant. */
  targeting?: EffectScheduleTargeting;
  /** Short summary copied from canonical prose for review parity. */
  summary: string;
  /** Short review note for schedule facts that do not deserve a new field yet. */
  notes?: string;
}

/** Top-level schedule for spells whose active effects change by turn or phase. */
export interface EffectSchedule {
  /** Overall schedule timing, currently focused on later caster turns. */
  timing: "caster_later_turn_start";
  /** Ordered stages that tell the runtime which effect packets fire when. */
  entries: EffectScheduleEntry[];
  /** Explains what the schedule covers and what remains in normal effects. */
  notes?: string;
}

//==============================================================================
// Mode Choice Metadata
//==============================================================================
// These types track "choose one of the following effects" menus. They do not
// duplicate target selection; instead, they name the spell operation chosen and
// point to the existing runtime payloads that perform that operation.
//==============================================================================

/** One selectable option in a spell mode menu. */
export interface ModeChoiceOption {
  /** Canonical option name or normalized label shown to the caster. */
  label: string;
  /** Short explanation of what the selected option does. */
  summary: string;
  /** Runtime effect array indexes that implement this option, if already split. */
  effectIndices?: number[];
  /** Utility control option indexes that carry the prose payload for this option. */
  controlOptionIndices?: number[];
  /** Broad effect families touched by this option, kept for audit/review. */
  effectTypes?: string[];
  /** Human-readable duration when an option differs from the spell header. */
  duration?: string;
  /** Short caveat for option-specific limits that are not fielded yet. */
  notes?: string;
}

/** Top-level mode menu for spells that ask the caster to choose one operation. */
export interface ModeChoice {
  /** Source-backed menu shape, including choose_multiple variants. */
  type: string;
  /** Source-backed timing label for cast-time or later-action choices. */
  timing: string;
  /**
   * How many menu entries the caster commits to per resolution.
   *
   * Single-select menus (`choose_one`, `choose_one_per_target`) pick exactly
   * one entry each time they resolve, so their `optionCount` records the menu
   * size and must equal `options.length`. Multi-select menus
   * (`choose_multiple`) pick several entries out of a larger menu, so their
   * `optionCount` records the selection budget and stays at or below
   * `options.length` - Commune with Nature chooses 3 of 5.
   */
  optionCount: number;
  /** Fewest entries a multi-select menu may commit to, when the source allows a range. */
  minSelections?: number;
  /** Most entries a multi-select menu may commit to, when the source allows a range. */
  maxSelections?: number;
  /** Where the option payloads live so runtime/UI code can follow them. */
  optionsSource: string;
  /** Active cap for non-instantaneous options, or a sentinel when none exists. */
  maxActiveNonInstantaneous?: number | "not_applicable";
  /** Whether the spell allows active non-instantaneous options to be dismissed. */
  canDismissActive?: boolean | "not_applicable";
  /** Canonical list of selectable operations. */
  options: ModeChoiceOption[];
  /** Short review note for menu-wide details that are not fielded yet. */
  notes?: string;
}

//==============================================================================
// Granted Action Metadata
//==============================================================================
// Some spells hand the caster, or a controlled entity, an extra action while
// the spell runs: commanding an animated Undead, asking an otherworldly entity
// a question, or moving a whirlwind. Those rows live on
// `effects[].grantedActions` and use two authored spellings, so the canonical
// cost vocabulary is declared here once and both spellings normalize onto it.
//==============================================================================

/** Canonical cost the action economy spends for one granted action. */
export type SpellActionCost =
  /** Costs the actor's Action, including the 2024 Magic action. */
  | 'action'
  /** Costs the actor's Bonus Action. */
  | 'bonus_action'
  /** Costs the actor's Reaction. */
  | 'reaction'
  /** Costs nothing: free commands, no-action orders, and narrative control. */
  | 'free'
  /** Not an action at all; it changes how another action resolves. */
  | 'special';

/**
 * One extra action a spell grants while it is active.
 *
 * The canonical spelling is `type` / `action` / `frequency`. Older rows author
 * the same three facts as `actionType` / `name` / `timing` or `cost`, so both
 * spellings are declared here and `SpellIntegrityValidator` normalizes a row
 * before it checks the row.
 */
export interface GrantedAction {
  /** Source-backed action cost, mapped through the canonical action-cost table. */
  type?: string;
  /** Legacy spelling of `type`. */
  actionType?: string;
  /** Caster-facing label for the granted action. */
  action?: string;
  /** Legacy spelling of `action`. */
  name?: string;
  /** Cadence the granted action repeats on, such as `each_caster_turn`. */
  frequency?: string;
  /** Legacy cadence spelling used by turn- or phase-bound rows. */
  timing?: string;
  /** Legacy cadence spelling used by rows paid out of a limited pool. */
  cost?: string;
  /** Who takes the granted action when it is not the caster. */
  actor?: string;
  /** Range cap in feet under the canonical spelling. */
  rangeLimit?: number;
  /** Legacy range-cap spelling in feet. */
  rangeFeet?: number;
  /** Legacy range-cap spelling paired with `rangeUnit`. */
  range?: number;
  /** Short review note for facts that are not fielded yet. */
  notes?: string;
  /** Prose restatement kept by legacy rows. */
  description?: string;
}
