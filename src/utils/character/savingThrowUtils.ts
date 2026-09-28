/**
 * @file src/utils/savingThrowUtils.ts
 * Utility functions for handling saving throws in D&D 5e combat.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: commands/effects/GrantedActionCommand.ts, commands/factory/SpellCommandFactory.ts, commands/factory/boomingBladeAttackBridge.ts, commands/factory/greenFlameBladeAttackBridge.ts, commands/factory/trueStrikeAttackBridge.ts, components/CharacterCreator/SkillSelection.tsx, components/DesignPreview/steps/raceDomain/leaves/autumnEladrinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blackDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blueDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/brassDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bronzeDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/deepGnomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/drowHalfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/earthGenasiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/forestGnomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/frostGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/giffRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githzeraiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goldDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/grayDwarfDuergarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/greenDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/hadozeeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halflingRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/multiattackRidersScenarioControls.ts, components/DesignPreview/steps/scenarioControls/repeatSavesConditionExpiryScenarioControls.ts, components/DesignPreview/steps/scenarioControls/savingThrowsHalfDamageScenarioControls.ts, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, components/DesignPreview/steps/spells/fireBoltScenario.tsx, systems/combat/reactions/companionProtectionReaction.ts, systems/perception/eventDetection.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/sourceSaveModifierResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, systems/spells/socialServiceResolution.ts, systems/travel/forcedMarch.ts, utils/character/concentrationUtils.ts, utils/character/index.ts, utils/character/skillModifierUtils.ts, utils/combat/archfeyUtils.ts, utils/combat/battleMasterUtils.ts, utils/combat/beastMasterUtils.ts, utils/combat/multiattackUtils.ts, utils/combat/openHandUtils.ts, utils/combat/shoveUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
    CombatCharacter,
} from '../../types/combat';
import { rollDice } from '../../systems/dice/rollers';
import { getAbilityModifierValue } from './statUtils';
import {
    SavingThrowAbility,
    SaveOutcomeOverride
} from '../../types/spells';

/**
 * The lowercase `CharacterStats` key for each capitalized ability name.
 * Replaces the previous `ability.toLowerCase() as keyof typeof stats` casts so
 * the compiler validates that an ability name always resolves to a real,
 * numeric stat key instead of trusting a string cast (see GG-24).
 */
type AbilityStatKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

const ABILITY_STAT_KEYS: Record<SavingThrowAbility, AbilityStatKey> = {
    Strength: 'strength',
    Dexterity: 'dexterity',
    Constitution: 'constitution',
    Intelligence: 'intelligence',
    Wisdom: 'wisdom',
    Charisma: 'charisma',
};

// ============================================================================
// PHB 2024 Saving-Throw Rule Helpers (SYS-2)
// ============================================================================
// Two 2024 Player's Handbook rules were only partly represented in this file.
//
// 1. PROFICIENCY STACKING. The Proficiency Bonus is added to a d20 Test at most
//    ONCE, however many sources grant proficiency in that save (class table,
//    the Resilient feat, a species or background grant). The single add below
//    already honored that, but the two proficiency lists are authored
//    inconsistently ("Dexterity", "dexterity", "dex", " Dexterity "), and the
//    old exact lowercase compare silently missed every variant — so a real
//    grant could drop the bonus entirely. One alias table fixes the miss while
//    keeping the add-once behavior intact.
//
// 2. SPECIES TRAITS. 2024 traits phrase their narrowing as a CONDITION, not a
//    damage type: Fey Ancestry ("advantage on saving throws you make to avoid
//    or end the Charmed condition"), Brave (Frightened), Dwarven Resilience
//    (Poisoned). The old `against\s+([a-z]+)` capture matched none of those
//    wordings, and captured the filler word "being" from "against being
//    frightened" — so each of those traits granted advantage on EVERY saving
//    throw. Several DesignPreview race leaves strip the raw parser projection
//    to work around exactly that; those adapters keep working unchanged, they
//    are simply no longer the only defense.
//
// PRESERVED: narrowing still applies ONLY when the caller supplies an
// effectContext. A call with no context keeps the pre-existing broad behavior,
// which the existing legacy-string tests pin.
// ============================================================================

/** Ability spellings accepted inside saving-throw proficiency lists. */
const SAVE_PROFICIENCY_ALIASES: Record<string, AbilityStatKey> = {
    str: 'strength', strength: 'strength',
    dex: 'dexterity', dexterity: 'dexterity',
    con: 'constitution', constitution: 'constitution',
    int: 'intelligence', intelligence: 'intelligence',
    wis: 'wisdom', wisdom: 'wisdom',
    cha: 'charisma', charisma: 'charisma',
};

/** Condition names a species trait can narrow a saving throw to. */
const SAVE_CONDITION_QUALIFIERS = [
    'charmed', 'frightened', 'poisoned', 'paralyzed', 'petrified', 'stunned',
    'blinded', 'deafened', 'restrained', 'grappled', 'incapacitated',
    'unconscious', 'exhaustion', 'diseased', 'disease', 'prone',
];

/** Words that can follow "against" without naming what is being saved against. */
const QUALIFIER_FILLER = new Set([
    'being', 'been', 'becoming', 'the', 'a', 'an', 'all', 'any', 'your', 'their',
]);

/** Reduce a qualifier to a comparable stem so "Poisoned" and "poison" agree. */
function qualifierStem(value: string): string {
    const text = value.trim().toLowerCase();
    return text.length > 3 && text.endsWith('ed') ? text.slice(0, -2) : text;
}

/**
 * True when a trait qualifier and an incoming effect tag name the same thing,
 * tolerating the condition/noun spelling split ("Poisoned condition" vs the
 * effect tag "poison") that PHB 2024 species wording makes routine.
 */
export function qualifierMatches(qualifier: string, effectTag: string): boolean {
    const left = qualifierStem(qualifier);
    const right = qualifierStem(effectTag);
    if (!left || !right) return false;
    if (left === right) return true;
    const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
    return shorter.length >= 4 && longer.startsWith(shorter);
}

/**
 * Pull the "what is this save against?" qualifiers out of free-text trait wording.
 * Returns an empty list for an unconditional modifier ("advantage on all saving
 * throws"), which callers treat as "applies regardless of effect context".
 */
export function extractSaveQualifiers(modifierText: string): string[] {
    const text = modifierText.toLowerCase();
    const found = new Set<string>();

    // 2024 phrasing: "...to avoid or end the Frightened condition".
    for (const condition of SAVE_CONDITION_QUALIFIERS) {
        if (text.includes(condition)) found.add(condition);
    }

    // Legacy phrasing: "against poison", "against being frightened". Only the
    // first meaningful word is taken, deliberately: grabbing the whole trailing
    // phrase would widen a narrow trait back out into a broad one.
    const againstPattern = /against\s+(?:(?:being|been|becoming|the|a|an|all|any|your|their)\s+)*([a-z]+)/g;
    let match: RegExpExecArray | null;
    while ((match = againstPattern.exec(text)) !== null) {
        const word = match[1];
        if (!QUALIFIER_FILLER.has(word) && word !== 'condition') found.add(word);
    }

    return [...found];
}

/**
 * Whether the character is proficient in this saving throw, from ANY source.
 *
 * Collapsing every source to one boolean is what enforces the PHB 2024 rule
 * that the Proficiency Bonus is never added twice: a Fighter who also takes
 * Resilient (Constitution) is proficient once, not twice. Entries are matched
 * through the alias table so authored spelling variants still count.
 */
export function hasSavingThrowProficiency(
    target: Pick<CombatCharacter, 'class' | 'savingThrowProficiencies'>,
    ability: SavingThrowAbility
): boolean {
    const wanted = SAVE_PROFICIENCY_ALIASES[ability.trim().toLowerCase()];
    if (!wanted) return false;

    const sources = [
        ...(target.class?.savingThrowProficiencies ?? []),
        ...(target.savingThrowProficiencies ?? []),
    ];

    return sources.some(entry => (
        SAVE_PROFICIENCY_ALIASES[String(entry ?? '').trim().toLowerCase()] === wanted
    ));
}

/**
 * Result of a saving throw roll.
 * Includes the raw roll, total after modifiers, and whether it succeeded.
 */
export interface SavingThrowResult {
    /** Whether the save was successful (total >= dc) */
    success: boolean;
    /** The raw d20 roll before modifiers */
    roll?: number;
    /** Final total: roll + ability mod + proficiency + external modifiers */
    total: number;
    /** The difficulty class that needed to be met or exceeded */
    dc?: number;
    /** True if the raw roll was 20 (auto-success in some contexts) */
    natural20?: boolean;
    /** True if the raw roll was 1 (auto-fail in some contexts) */
    natural1?: boolean;
    /** List of modifiers that were applied (e.g., Bless, Mind Sliver) */
    modifiersApplied?: { source: string; value: number }[];
}

/**
 * Modifier to apply to a saving throw from external effects.
 * Supports both bonuses (Bless) and penalties (Mind Sliver).
 */
export interface SavingThrowModifier {
    dice?: string;    // e.g. "1d4" (bonus) or "-1d4" (penalty). Will be rolled and ADDED.
    flat?: number;    // e.g. 2 (bonus) or -2 (penalty). Will be ADDED.
    source: string;   // Name of the effect that caused this modifier
}

/**
 * Describes the incoming effect that a saving throw is being made against.
 *
 * Threading this into {@link rollSavingThrow} lets contextual advantage — such as
 * "advantage on saving throws against poison" — match ONLY the relevant effect
 * instead of applying to every save (see RM-SAVE-001).
 *
 * Backward-compatible: when omitted, contextual narrowing is skipped and the roll
 * behaves identically to the pre-context implementation.
 */
export interface SaveEffectContext {
    /** Damage type of the incoming effect, e.g. 'poison', 'fire', 'psychic'. */
    damageType?: string;
    /** Free-form descriptive tags for the effect, e.g. ['poison', 'magic', 'disease']. */
    tags?: string[];
}

// ============================================================================
// Deterministic Roll Input
// ============================================================================
// Ordinary combat omits this option and keeps the normal random stream. Rules
// laboratories and deterministic simulations can supply the stream while still
// exercising every modifier, proficiency, and advantage rule in this file.
// ============================================================================

export interface SavingThrowRollOptions {
    /** Supplies the random stream without replacing the shared dice engine. */
    rng?: () => number;
}

/**
 * Resolve save-outcome overrides whose condition is represented by the
 * combat character model or context.
 *
 * Supported conditions:
 * - not_humanoid (auto_success)
 * - immune_to_frightened (auto_success)
 * - immune_to_charmed (auto_success)
 * - creature_does_not_sleep_or_has_exhaustion_immunity (auto_success)
 * - is_plant_creature (auto_failure)
 * - target_size_huge_or_larger / target_is_huge_or_larger (auto_success)
 * - fighting_caster_or_allies / caster_fighting_target (auto_success)
 * - voluntary_failure / voluntary_failure_allowed (when target.voluntaryFailure is true)
 *
 * @param overrides - The list of save outcome overrides from spell data
 * @param target - The defending character (and optional context flags)
 * @param dc - The spell save DC
 * @param casterTeam - Optional team identifier of the caster for hostility checks
 * @returns An overridden SavingThrowResult if matched, or undefined to roll normally
 */
export function resolveSaveOutcomeOverride(
    overrides: SaveOutcomeOverride[] | undefined,
    target: Partial<CombatCharacter> & {
        creatureTypes?: string[];
        conditionImmunities?: string[];
        stats?: { size?: string; creatureTypes?: string[] };
        team?: string;
        casterTeam?: string;
        voluntaryFailure?: boolean;
    },
    dc: number,
    casterTeam?: string
): SavingThrowResult | undefined {
    if (!overrides?.length) return undefined;

    // Collect creature types (preferring root creatureTypes, falling back to stats.creatureTypes)
    const creatureTypes = (target.creatureTypes ?? target.stats?.creatureTypes ?? []).map(type => type.toLowerCase());

    const conditionImmunities = new Set(
        (target.conditionImmunities ?? []).map(condition => condition.toLowerCase())
    );

    // Normalize target size
    const targetSize = (target.stats?.size ?? (target as { size?: string }).size ?? '').toLowerCase();
    const isHugeOrLarger = targetSize === 'huge' || targetSize === 'gargantuan';
    const isLargeOrSmaller = targetSize === 'large' || targetSize === 'medium' || targetSize === 'small' || targetSize === 'tiny';

    // Check team hostility
    const effectiveCasterTeam = casterTeam ?? target.casterTeam;
    const isFightingCaster = Boolean(
        target.team &&
        effectiveCasterTeam &&
        target.team !== effectiveCasterTeam
    );

    for (const override of overrides) {
        const condition = String(override.condition ?? '').toLowerCase();
        let matches = false;

        if (override.outcome === 'auto_success' && condition === 'not_humanoid') {
            matches = creatureTypes.length > 0 && !creatureTypes.includes('humanoid');
        } else if (override.outcome === 'auto_success' && condition === 'immune_to_frightened') {
            matches = conditionImmunities.has('frightened');
        } else if (override.outcome === 'auto_success' && condition === 'immune_to_charmed') {
            matches = conditionImmunities.has('charmed');
        } else if (
            override.outcome === 'auto_success' &&
            condition === 'creature_does_not_sleep_or_has_exhaustion_immunity'
        ) {
            matches = creatureTypes.includes('elf') || conditionImmunities.has('exhaustion');
        } else if (override.outcome === 'auto_failure' && condition === 'is_plant_creature') {
            matches = creatureTypes.includes('plant');
        } else if (
            override.outcome === 'auto_success' &&
            (condition === 'target_size_huge_or_larger' || condition === 'target_is_huge_or_larger')
        ) {
            matches = isHugeOrLarger;
        } else if (
            override.outcome === 'auto_success' &&
            (condition === 'fighting_caster_or_allies' || condition === 'caster_fighting_target')
        ) {
            matches = isFightingCaster;
        } else if (
            (override.outcome === 'voluntary_failure' || override.outcome === 'voluntary_failure_allowed') &&
            target.voluntaryFailure === true
        ) {
            if (condition === 'target_size_large_or_smaller') {
                matches = isLargeOrSmaller;
            } else {
                matches = true;
            }
        }

        if (matches) {
            // The override is a save result, not a replacement damage/status
            // outcome. Callers still apply their normal success/failure rules.
            const isSuccess = override.outcome === 'auto_success';
            return {
                success: isSuccess,
                total: isSuccess ? dc : 0,
                dc,
                modifiersApplied: []
            };
        }
    }

    return undefined;
}

/**
 * Structured saving-throw advantage/disadvantage modifier.
 *
 * Replaces brittle free-text strings ("advantage on Intelligence saving throws")
 * with an explicit, matchable shape so advantage applies precisely (see RM-SAVE-002).
 */
export interface SaveAdvantageModifier {
    /** Whether this grants advantage or imposes disadvantage. */
    type: 'advantage' | 'disadvantage';
    /**
     * The roll context this applies to. Fixed to 'saving_throw' today; present so a
     * single modifier list can later host attack/check contexts without a shape change.
     */
    context: 'saving_throw';
    /**
     * Ability names this applies to (e.g. ['Intelligence', 'Wisdom']).
     * Omitted or empty = every ability (e.g. "advantage on all saving throws").
     */
    abilities?: SavingThrowAbility[];
    /**
     * Effect tags / damage types this is limited to, e.g. ['poison'].
     * Omitted or empty = unconditional (applies regardless of effectContext).
     * When set, requires effectContext to carry a matching damageType or tag.
     */
    against?: string[];
    /** Optional label for logging/debugging. */
    source?: string;
}

/**
 * Calculates the proficiency bonus based on character level/CR.
 * Formula: 2 + floor((level - 1) / 4)
 * Level 1-4 = +2, 5-8 = +3, etc.
 */
export function calculateProficiencyBonus(level: number): number {
    return 2 + Math.floor(Math.max(0, level - 1) / 4);
}

/**
 * Calculates the Spell Save DC for a character.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier
 */
export function calculateSpellDC(caster: CombatCharacter): number {
    const level = caster.level || 1;
    const pb = calculateProficiencyBonus(level);

    // Identify spellcasting ability from class, default to Intelligence if unknown
    const abilityName = caster.class?.spellcasting?.ability || 'Intelligence';
    const score = caster.stats[ABILITY_STAT_KEYS[abilityName]] ?? 10;
    const mod = getAbilityModifierValue(score);

    return 8 + pb + mod;
}

/**
 * Rolls a saving throw for a character against a target DC.
 * @param target The character making the save
 * @param ability The ability to use for the save
 * @param dc The difficulty class to beat
 * @param modifiers Optional array of modifiers from active effects (e.g., Mind Sliver's -1d4)
 * @param effectContext Optional description of the effect being saved against (damage type / tags).
 *   Enables contextual advantage (e.g. "against poison") to match only the relevant effect.
 *   Backward-compatible: when omitted, contextual narrowing is skipped.
 * @param structuredModifiers Optional structured advantage/disadvantage modifiers. These match
 *   precisely on ability and effect context, and are preferred over the legacy free-text strings.
 * @param options Optional deterministic roll input for simulations and focused proof.
 */
export function rollSavingThrow(
    target: CombatCharacter,
    ability: SavingThrowAbility,
    dc: number,
    modifiers?: SavingThrowModifier[],
    effectContext?: SaveEffectContext,
    structuredModifiers?: SaveAdvantageModifier[],
    options: SavingThrowRollOptions = {}
): SavingThrowResult {
    // Step 0: Check for Advantage/Disadvantage (Racial Modifiers, etc.)
    let hasAdvantage = false;
    let hasDisadvantage = false;

    const ALL_ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const abilityLower = ability.toLowerCase();

    // True when the effect being saved against carries one of the given tags/damage types.
    // No context supplied ⇒ a contextual ("against X") modifier cannot be confirmed, so it does not apply.
    const contextMatches = (against?: string[]): boolean => {
        if (!against || against.length === 0) return true; // unconditional modifier
        if (!effectContext) return false;                  // contextual modifier needs a context to match
        const haystack: string[] = [];
        if (effectContext.damageType) haystack.push(effectContext.damageType);
        effectContext.tags?.forEach(tag => haystack.push(tag));
        // Stem-tolerant (see qualifierMatches): a trait written as the condition
        // ("Poisoned condition") still matches an effect tagged with the bare
        // noun ("poison"). Exact tags keep matching exactly as before.
        return against.some(a => haystack.some(tag => qualifierMatches(a, tag)));
    };

    const checkModifier = (modText: string) => {
        const text = modText.toLowerCase();
        // A modifier only applies to saving throws if it explicitly mentions "saving throw" or "save"
        // (to avoid applying "Dexterity (Stealth) checks" to Dexterity saving throws).
        if (text.includes('saving throw') || text.includes('save')) {
            const mentionsAnyAbility = ALL_ABILITIES.some(ab => text.includes(ab));
            if (mentionsAnyAbility && !text.includes(abilityLower)) {
                // Mentions specific abilities but not this one — does not apply.
                return false;
            }
            // Contextual qualifier: phrases like "against poison" should only apply when the
            // incoming effect matches. We only narrow when an effectContext was supplied, so
            // callers that pass no context keep the original (broad) behavior for legacy strings.
            // PHB 2024 species traits narrow by CONDITION, not damage type, so the
            // qualifier extractor reads both wordings. Preserved: narrowing only
            // happens when the caller supplied an effectContext.
            const qualifiers = extractSaveQualifiers(text);
            if (qualifiers.length > 0 && effectContext) {
                return contextMatches(qualifiers);
            }
            // Generic saving throw modifier (e.g., "all saving throws"), or a contextual string with
            // no effectContext to narrow against (legacy broad behavior preserved).
            return true;
        }
        return false;
    };

    target.modifiers?.advantage.forEach(adv => {
        if (checkModifier(adv)) hasAdvantage = true;
    });
    target.modifiers?.disadvantage.forEach(dis => {
        if (checkModifier(dis)) hasDisadvantage = true;
    });

    // Structured modifiers (RM-SAVE-002): explicit shape, matched precisely on ability + context.
    structuredModifiers?.forEach(mod => {
        if (mod.context !== 'saving_throw') return;
        const abilityApplies = !mod.abilities || mod.abilities.length === 0
            || mod.abilities.some(ab => ab.toLowerCase() === abilityLower);
        if (!abilityApplies) return;
        if (!contextMatches(mod.against)) return;
        if (mod.type === 'advantage') hasAdvantage = true;
        else hasDisadvantage = true;
    });

    // Step 1: Roll the d20. Supplying an RNG changes only the random source;
    // the shared parser and every save modifier below remain authoritative.
    const rollWithConfiguredRandom = (dice: string): number => options.rng
        ? rollDice(dice, { rng: options.rng })
        : rollDice(dice);
    let roll = rollWithConfiguredRandom('1d20');
    if (hasAdvantage && !hasDisadvantage) {
        const roll2 = rollWithConfiguredRandom('1d20');
        roll = Math.max(roll, roll2);
    } else if (hasDisadvantage && !hasAdvantage) {
        const roll2 = rollWithConfiguredRandom('1d20');
        roll = Math.min(roll, roll2);
    }

    // Step 2: Calculate ability modifier from the relevant stat
    // E.g., for a Dexterity save, look up target.stats.dexterity
    const abilityKey = ABILITY_STAT_KEYS[ability];
    const score = target.stats[abilityKey] ?? 10;
    let mod = getAbilityModifierValue(score);

    // Step 3: Check for explicit save bonus override (populated for monsters from 5eTools `save` field).
    // When present, these replace the computed abilityMod so the total matches the published stat block.
    // Map full ability name to abbreviated key ("Dexterity" → "dex").
    const ABILITY_ABBREV: Record<string, string> = {
      strength: 'str', dexterity: 'dex', constitution: 'con',
      intelligence: 'int', wisdom: 'wis', charisma: 'cha',
    };
    const saveKey = ABILITY_ABBREV[abilityKey] ?? abilityKey.slice(0, 3);
    const explicitSaveBonus = target.stats.saveBonuses?.[saveKey];
    if (explicitSaveBonus !== undefined) {
      // Explicit override wins — matches published monster stat block exactly.
      mod = explicitSaveBonus;
    } else {
      // Add proficiency bonus if the character is proficient in this save
      // Proficiency can come from class (e.g., Fighters are proficient in Str/Con)
      // or from the character directly (e.g., Resilient feat grants proficiency)
      // PHB 2024: the Proficiency Bonus is added to a d20 Test at most ONCE,
      // however many sources grant proficiency in this save. hasSavingThrowProficiency
      // collapses class grants and character grants (Resilient, species, background)
      // to a single boolean, so the add below can never stack, and it normalizes
      // authored spelling variants ("dex", " Dexterity ") that the previous exact
      // lowercase compare missed — which dropped the bonus rather than doubling it.
      if (hasSavingThrowProficiency(target, ability)) {
          mod += calculateProficiencyBonus(target.level || 1);
      }
    }

    // Step 4: Apply external modifiers from active effects
    // Examples:
    //   - Bless: +1d4 (bonus)
    //   - Mind Sliver: -1d4 (penalty, applied to next save)
    //   - Cover: +2 flat bonus
    // These are tracked for logging purposes
    const modifiersApplied: { source: string; value: number }[] = [];

    // Racial Bonuses (from modifierBuckets.bonuses)
    target.modifiers?.bonuses.forEach(bonus => {
        const text = bonus.toLowerCase();
        // Check for ability specific bonus (e.g., "d4 to Dexterity")
        // or general saving throw bonus (e.g., "d4 to saving throws")
        const isTargetMatch = text.includes(ability.toLowerCase()) || 
                             text.includes('saving throw') || 
                             (ability === 'Intelligence' && text.includes('arcana')) || // Some intuition phrasings might bleed
                             (ability === 'Wisdom' && (text.includes('insight') || text.includes('perception')));

        if (isTargetMatch) {
            // Extract dice/flat from text like "d4 to saving throws" or "+2 to Dexterity"
            const diceMatch = bonus.match(/(\d*d\d+)/i);
            // Signed flat bonuses use an unescaped character class so lint stays clean without changing behavior.
            const flatMatch = bonus.match(/([+-]\d+)/);
            if (diceMatch) {
                const val = rollWithConfiguredRandom(diceMatch[1] || '1d4'); // Default to 1d4 if just "d4"
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            } else if (flatMatch) {
                const val = parseInt(flatMatch[1], 10);
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            }
        }
    });

    if (modifiers && modifiers.length > 0) {
        for (const modifier of modifiers) {
            // Dice modifiers (e.g., "1d4" or "-1d4") are rolled and added
            if (modifier.dice) {
                const diceRoll = rollWithConfiguredRandom(modifier.dice);
                mod += diceRoll;
                modifiersApplied.push({ source: modifier.source, value: diceRoll });
            }
            // Flat modifiers (e.g., +2 from cover) are added directly
            if (modifier.flat !== undefined) {
                mod += modifier.flat;
                modifiersApplied.push({ source: modifier.source, value: modifier.flat });
            }
        }
    }

    // Step 5: Calculate final total and determine success
    const total = roll + mod;

    return {
        success: total >= dc,  // Must meet or beat the DC
        roll,                  // Raw d20 result
        total,                 // Final modified result
        dc,                    // The target DC
        natural20: roll === 20, // For special auto-success rules
        natural1: roll === 1,   // For special auto-fail rules
        modifiersApplied: modifiersApplied.length > 0 ? modifiersApplied : undefined
    };
}

/**
 * Calculates final damage based on saving throw result.
 */
// These labels are the small executable subset currently understood by damage
// resolution. The authored corpus also uses `negates` and `negates_effect`;
// both mean that a successful save prevents the effect in this damage path.
export type SaveEffectOutcome =
    | 'none'
    | 'half'
    | 'negates_condition'
    | 'negates_effect'
    | 'negates';

// Convert source-backed save wording to the normalized outcome used by damage
// commands. This keeps Heat Metal-style live data from silently dealing full
// damage after a successful save simply because its label was not canonical.
export function calculateSaveDamage(
    initialDamage: number,
    saveResult: SavingThrowResult,
    effectType: SaveEffectOutcome = 'half'
): number {
    // Failed save = full damage always
    if (!saveResult.success) {
        return initialDamage;
    }

    // --- SUCCESSFUL SAVE OUTCOMES ---

    // Source-backed aliases all represent a fully negated effect in this
    // damage-only function. Other richer save metadata remains owned by the
    // status, movement, or utility command that understands its full wording.
    const normalizedEffectType =
        effectType === 'negates' || effectType === 'negates_effect'
            ? 'negates_condition'
            : effectType;

    // 'half': Standard for most leveled spells (Fireball, Lightning Bolt, etc.)
    // Successful save reduces damage to half (rounded down)
    if (normalizedEffectType === 'half') {
        return Math.floor(initialDamage / 2);
    }

    // 'none': Used by save cantrips whose successful save should deal no damage.
    // Sacred Flame, Thunderclap, Word of Radiance, and similar rows rely on this
    // shared convention so the failure branch still hits for full damage while the
    // success branch collapses to zero.
    if (normalizedEffectType === 'none') {
        return 0;
    }

    // 'negates_condition': Used for effects where a save completely avoids the effect.
    // For damage context, this also means 0 damage on success.
    if (normalizedEffectType === 'negates_condition') {
        return 0;
    }

    return initialDamage;
}
