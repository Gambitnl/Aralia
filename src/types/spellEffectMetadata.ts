// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 02:54:45
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
  /** Current menu shape: the caster chooses exactly one operation. */
  type: "choose_one";
  /** When the spell asks the caster to choose or change the operation. */
  timing: "on_cast" | "on_cast_or_later_action";
  /** Number of options in the canonical menu. */
  optionCount: number;
  /** Where the option payloads live so runtime/UI code can follow them. */
  optionsSource: "modeChoice.options" | "effects" | "controlOptions" | "mixed";
  /** Active cap for non-instantaneous options, or a sentinel when none exists. */
  maxActiveNonInstantaneous?: number | "not_applicable";
  /** Whether the spell allows active non-instantaneous options to be dismissed. */
  canDismissActive?: boolean | "not_applicable";
  /** Canonical list of selectable operations. */
  options: ModeChoiceOption[];
  /** Short review note for menu-wide details that are not fielded yet. */
  notes?: string;
}
