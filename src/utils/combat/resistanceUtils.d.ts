/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:06:46
 * Dependents: commands/effects/DamageCommand.ts, utils/combat/combatUtils.ts, utils/combat/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { DamageType } from '@/types/spells';
import type { CombatCharacter } from '@/types';
import { type ActiveSpellZone } from '@/systems/spells/effects/triggerHandler';
type ResistanceSpellZone = Pick<ActiveSpellZone, 'id' | 'spellId' | 'casterId' | 'position' | 'areaOfEffect' | 'direction' | 'effects' | 'targetingValidTargets'>;
/**
 * Optional zone state threaded into damage resolution so protective auras can
 * affect damage the same turn they are active on the map.
 */
export interface ResistanceZoneContext {
    spellZones?: ResistanceSpellZone[];
    characters?: CombatCharacter[];
}
/**
 * Applies damage resistance/vulnerability/immunity logic based on D&D 5e rules.
 * This centralized utility ensures consistent application of rules like:
 * - Immunity > Resistance/Vulnerability
 * - Resistance and Vulnerability cancelling out (XGtE)
 * - Elemental Adept feat bypassing resistance
 */
export declare class ResistanceCalculator {
    /**
     * Calculate final damage after resistances, vulnerabilities, and immunities.
     *
     * @param baseDamage - Damage before resistances
     * @param damageType - Type of damage
     * @param target - Character taking damage
     * @param source - Source of damage (optional, for checking feats like Elemental Adept)
     * @returns Final damage amount
     *
     * @example
     * // Fire Elemental takes cold damage
     * const finalDamage = ResistanceCalculator.applyResistances(
     *   20,
     *   'Cold',
     *   fireElemental
     * )
     * // Returns 40 (vulnerable to cold)
     */
    static applyResistances(baseDamage: number, damageType: DamageType, target: CombatCharacter, source?: CombatCharacter | null, isMagical?: boolean, zoneContext?: ResistanceZoneContext): number;
    /**
     * Check if character is immune to damage type.
     * When isMagical is explicitly false, also checks nonMagicalImmunities
     * (e.g. lycanthropes are immune to nonmagical bludgeoning/piercing/slashing).
     *
     * WHAT CHANGED: Added status effect and active effect modifiers check for immunities.
     * WHY IT CHANGED: Both status effects and active spell effects (such as Protection
     * from Energy or temporary spell shielding) can grant temporary damage immunities,
     * which are registered under statusEffects[].modifiers.immunity and activeEffects[].mechanics.damageImmunity.
     */
    private static isImmune;
    /**
     * Check if character is resistant to damage type.
     * When isMagical is explicitly false, also checks nonMagicalResistances.
     *
     * WHAT CHANGED: Added status effect and active effect modifiers check for resistances.
     * WHY IT CHANGED: Active status effects (like Barbarian Rage) and active spell
     * effects (like Warding or Resist Elements) can grant temporary damage resistances,
     * registered in statusEffects[].modifiers.resistance or activeEffects[].mechanics.damageResistance.
     */
    private static isResistant;
    /**
     * Check if character is vulnerable to damage type.
     *
     * WHAT CHANGED: Added status effect and active effect modifiers check for vulnerabilities.
     * WHY IT CHANGED: Active status effects and active spell effects can impose temporary damage vulnerabilities
     * registered in statusEffects[].modifiers.vulnerability or activeEffects[].mechanics.damageVulnerability.
     */
    private static isVulnerable;
    /**
     * Check whether any active spell zone at the target's current tile grants the
     * requested defense. This keeps area auras and silence-style zones tied to
     * map position instead of target sheet data.
     */
    private static hasZoneDefense;
    /**
     * Preserve the source spell's targeting intent so ally-only auras do not
     * accidentally apply to enemies just because they share the same area.
     */
    private static zoneAppliesToCharacter;
}
export {};
