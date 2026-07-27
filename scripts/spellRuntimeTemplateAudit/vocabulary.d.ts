/**
 * This module owns the strict spell-template vocabulary used by the runtime audit.
 *
 * The main audit script asks whether each spell follows the shared structured
 * markdown and runtime JSON contract. Keeping the allowed labels and accepted
 * enum-like values here makes bucket migrations easier to review: adding a new
 * field family changes this registry, while the audit script keeps the checking
 * and report-writing behavior.
 *
 * Called by: `auditSpellRuntimeTemplate.ts`.
 * Depends on: no runtime data; this file is the static vocabulary registry.
 */
export declare const CANONICAL_STRUCTURED_LABELS: Set<string>;
export declare const NUMBERED_STRUCTURED_LABEL_PATTERNS: RegExp[];
export declare const DEPRECATED_LABEL_REPLACEMENTS: Map<string, string>;
export declare const CASTING_TIME_UNITS: Set<string>;
export declare const RANGE_TYPES: Set<string>;
export declare const DISTANCE_UNITS: Set<string>;
export declare const DURATION_TYPES: Set<string>;
export declare const DURATION_UNITS: Set<string>;
export declare const AREA_SHAPES: Set<string>;
export declare const AREA_SIZE_TYPES: Set<string>;
export declare const TARGET_WILLINGNESS: Set<string>;
export declare const TARGET_OBJECT_WORN_OR_CARRIED: Set<string>;
export declare const TARGET_OBJECT_MAGICAL_STATUS: Set<string>;
export declare const TARGET_OBJECT_FIXED_TO_SURFACE: Set<string>;
export declare const TARGET_COMMUNICATION_PREREQUISITE: Set<string>;
export declare const TARGET_ABILITY_THRESHOLD_ABILITIES: Set<string>;
export declare const TARGET_ABILITY_THRESHOLD_OPERATORS: Set<string>;
export declare const TARGET_SELF_RELATION: Set<string>;
export declare const AREA_TARGET_SELECTION_MODES: Set<string>;
export declare const AREA_TARGET_SELECTION_SCOPES: Set<string>;
export declare const AREA_TARGET_SELECTION_COUNTS: Set<string>;
export declare const TARGET_INSTANCE_TYPES: Set<string>;
export declare const TARGET_INSTANCE_ASSIGNMENTS: Set<string>;
export declare const TARGET_INSTANCE_RESOLUTIONS: Set<string>;
export declare const TARGET_CLUSTER_REQUIREMENTS: Set<string>;
export declare const TARGET_CLUSTER_SCOPES: Set<string>;
export declare const PER_TARGET_CHOICE_TYPES: Set<string>;
export declare const PER_TARGET_CHOICE_SCOPES: Set<string>;
export declare const SECONDARY_TARGET_TRIGGERS: Set<string>;
export declare const SECONDARY_TARGET_ORIGINS: Set<string>;
export declare const SECONDARY_TARGET_VALID_TARGETS: Set<string>;
export declare const SECONDARY_TARGET_SELECTIONS: Set<string>;
export declare const SECONDARY_TARGET_REPEAT_RULES: Set<string>;
export declare const SECONDARY_TARGET_MAX_LEAPS: Set<string>;
export declare const MODE_CHOICE_TYPES: Set<string>;
export declare const MODE_CHOICE_TIMINGS: Set<string>;
export declare const MODE_CHOICE_OPTIONS_SOURCES: Set<string>;
export declare const EFFECT_SCHEDULE_TIMINGS: Set<string>;
export declare const TARGETING_TYPES: Set<string>;
export declare const VALID_TARGETS: Set<string>;
export declare const SAVE_OUTCOMES: Set<string>;
export declare const SAVE_COVER_IGNORED: Set<string>;
export declare const SAVE_AUTO_OUTCOMES: Set<string>;
export declare const SAVE_AUTO_OUTCOME_CONDITIONS: Set<string>;
export declare const REPEAT_SAVE_TIMINGS: Set<string>;
export declare const REPEAT_SAVE_TYPES: Set<string>;
export declare const REPEAT_SAVE_PREREQUISITES: Set<string>;
export declare const SOUND_RADIUS_UNITS: Set<string>;
export declare const SOUND_SOURCES: Set<string>;
export declare const SOUND_TRIGGERS: Set<string>;
export declare const CONDITIONAL_ENDING_TRIGGERS: Set<string>;
export declare const ESCAPE_CHECK_ABILITIES: Set<string>;
export declare const ESCAPE_CHECK_ACTION_COSTS: Set<string>;
export declare const ESCAPE_CHECK_ELIGIBLE_ACTORS: Set<string>;
export declare const CONDITIONAL_ENDING_SCOPES: Set<string>;
export declare const SENSORY_MANIFESTATION_MODE_SOURCES: Set<string>;
export declare const SENSORY_CHANNELS: Set<string>;
export declare const SENSORY_MANIFESTATION_VOLUME_RANGES: Set<string>;
export declare const SENSORY_MANIFESTATION_TIMINGS: Set<string>;
export declare const SENSORY_MANIFESTATION_SHAPES: Set<string>;
export declare const SENSORY_MANIFESTATION_SIZE_UNITS: Set<string>;
export declare const ILLUSION_REVEAL_SCOPES: Set<string>;
export declare const ILLUSION_REVEAL_METHODS: Set<string>;
export declare const ILLUSION_REVEAL_ACTION_COSTS: Set<string>;
export declare const ILLUSION_REVEAL_ABILITIES: Set<string>;
export declare const ILLUSION_REVEAL_SKILLS: Set<string>;
export declare const ILLUSION_REVEAL_DCS: Set<string>;
export declare const ILLUSION_DISCERNED_STATES: Set<string>;
export declare const BOOLEAN_SENTINEL: Set<string>;
export declare const LIGHT_COLOR_CHOICES: Set<string>;
export declare const EFFECT_TYPES: Set<string>;
