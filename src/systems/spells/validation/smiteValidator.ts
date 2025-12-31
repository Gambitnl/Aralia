
import { Spell, SpellEffect } from '../../../types/spells';

/**
 * Validates that spells with 'Self' range but 'on_attack_hit' triggers (Smite-like spells)
 * are correctly configured to target the caster, not the enemy.
 *
 * Pattern:
 * - Range: Self (0)
 * - Trigger: on_attack_hit
 * - IMPLIED: Targeting must be Self (so the caster gains the buff that triggers on hit).
 *
 * Exception:
 * - Divine Smite (2024) is a special case where it is cast AFTER the hit, so it targets the enemy directly.
 * - However, mechanically, if it's "Range: Self", the user cannot select a distant enemy.
 */
export function validateSmiteTargeting(spell: Spell): string[] {
    const errors: string[] = [];

    // Check 1: Is it a Self-Range spell?
    if (spell.range.type !== 'self') return errors;

    // Check 2: Does it have an on_attack_hit trigger?
    const hasHitTrigger = spell.effects.some(e => e.trigger.type === 'on_attack_hit');

    if (!hasHitTrigger) return errors;

    // Issue: If it's Self-Range + Hit-Trigger, it's a "Next Hit Buff".
    // Therefore, the TARGET of the spell cast must be the Caster (Self).
    // If Targeting is "Single", the user is asked to select a target.
    // Since Range is 0, they can only select themselves (clunky) or fail.
    // Ideally, Targeting should be "Self".

    if (spell.targeting.type !== 'self') {
        // Special exclusions?
        // Divine Smite might be different, but let's flag it for now.
        errors.push(`Spell '${spell.id}' has Range: Self and Trigger: on_attack_hit (Smite pattern), but Targeting is '${spell.targeting.type}'. It should likely be 'self' to automatically buff the caster.`);
    }

    return errors;
}

/**
 * Validates that Divine Smite (2024 style) isn't self-immolating.
 * Pattern:
 * - Range: Self
 * - Trigger: Immediate
 * - Effect: Damage
 * - Targeting: Single (0 range)
 *
 * Result: Caster takes damage immediately.
 */
export function validateDivineSmite(spell: Spell): string[] {
    const errors: string[] = [];
    if (spell.id !== 'divine-smite') return errors;

    const damageEffect = spell.effects.find(e => e.type === 'DAMAGE') as any;
    if (!damageEffect) return errors;

    if (spell.range.type === 'self' && spell.targeting.type === 'single' && spell.targeting.range === 0) {
         if (damageEffect.trigger.type === 'immediate') {
             errors.push(`CRITICAL: '${spell.id}' targets Single entity at Range 0 (Self) with Immediate Damage. The Paladin will smite themselves.`);
         }
    }

    return errors;
}
