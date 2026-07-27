/**
 * @file src/systems/gameEntry/preRollBuffOffer.ts
 *
 * Pre-roll buff offers for the hostile-opening de-escalation check: detect
 * which of the character's KNOWN check-boosting spells (Guidance, Enhance
 * Ability, …) could help the skill about to be rolled, and build the
 * StatusEffect a real cast would apply.
 *
 * Detection is DATA-DRIVEN off the spell JSON (`effects[].abilityCheckModifier`
 * with `appliesTo: 'ability_check'`), not a hard-coded name list. The built
 * StatusEffect mirrors the exact shapes the combat engine produces
 * (UtilityCommand.applyAbilityCheckModifier / EnhanceAbilityCommand) so
 * `getActiveCheckBoosts` and `checkUtils.collectStructuredAbilityCheckBonuses`
 * read it identically to an in-combat cast.
 */
import type { PlayerCharacter } from '../../types';
import type { StatusEffect } from '../../types/effects';
/**
 * The slice of a spell definition this module reads. Kept structural (rather
 * than importing the full Spell type) so it tolerates the evolving spell
 * schema — these fields are stable across guidance.json / enhance-ability.json.
 */
export interface CheckBoostSpellShape {
    id: string;
    name: string;
    level: number;
    duration?: {
        type?: string;
        value?: number;
        unit?: string;
        concentration?: boolean;
    };
    /** Effect entries as opaque objects; the payload is narrowed at runtime so
     *  the full (and evolving) Spell effect union assigns without friction. */
    effects?: ReadonlyArray<object>;
}
export interface PreRollBuffOffer {
    spellId: string;
    spellName: string;
    /** The spell's own level (0 = cantrip). */
    level: number;
    /** Slot level the cast will consume; 0 for cantrips (free). */
    castAtLevel: number;
    kind: 'bonus-dice' | 'advantage';
    /** Present for kind 'bonus-dice', e.g. '1d4'. */
    bonusDice?: string;
    /** Player-facing cost line ("free" / "uses a level-2 spell slot"). */
    costLabel: string;
}
/**
 * Which of the given (already-resolved) spells are worth offering before a
 * roll of `skillName`? A spell qualifies when it carries an ability-check
 * payload, the character can pay for it, and an equivalent boost isn't
 * already active for this skill.
 */
export declare function findPreRollBuffOffers(args: {
    character: PlayerCharacter;
    skillName: string;
    spells: CheckBoostSpellShape[];
}): PreRollBuffOffer[];
/**
 * The StatusEffect a real cast of this spell applies for `skillName`,
 * mirroring the combat engine's shapes so every downstream reader
 * (getActiveCheckBoosts, checkUtils) treats it identically:
 *  - bonus-dice → UtilityCommand.applyAbilityCheckModifier's shape
 *  - advantage  → EnhanceAbilityCommand.createStatusEffect's shape,
 *    additionally scoped to the rolled skill via modifiers.skill (the offer
 *    is cast FOR this check, so the tighter scope is the honest one).
 */
export declare function buildCheckBoostStatusEffect(args: {
    spell: CheckBoostSpellShape;
    skillName: string;
    casterId: string;
}): StatusEffect;
