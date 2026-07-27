/**
 * ARCHITECTURAL CONTEXT:
 * This factory creates 'Rich Combat Messages'. It translates mechanical
 * events (like damage, kills, or spells) into human-readable notifications
 * and log entries.
 *
 * Recent updates focus on 'Dead Code Pruning'. The `formatTemplate` helper
 * was removed as the factory moved towards direct template literals for
 * string construction, which is more performant and type-safe in the
 * current TypeScript environment.
 *
 * @file src/utils/combat/messageFactory.ts
 */
import { CombatMessageType } from '../../types/combatMessages';
import type { CombatMessage } from '../../types/combatMessages';
import type { CombatCharacter } from '../../types/combat.js';
export declare function createDamageMessage(params: {
    source: CombatCharacter;
    target: CombatCharacter;
    damage: number;
    damageType: string;
    isCritical?: boolean;
    weaponName?: string;
    spellName?: string;
}): CombatMessage;
export declare function createKillMessage(params: {
    killer: CombatCharacter;
    victim: CombatCharacter;
}): CombatMessage;
export declare function createMissMessage(params: {
    attacker: CombatCharacter;
    defender: CombatCharacter;
}): CombatMessage;
export declare function createSpellMessage(params: {
    caster: CombatCharacter;
    target: CombatCharacter;
    spellName: string;
    success?: boolean;
}): CombatMessage;
export declare function createStatusMessage(params: {
    target: CombatCharacter;
    statusName: string;
    statusType: 'buff' | 'debuff' | 'condition';
    duration?: number;
}): CombatMessage;
export declare function createLevelUpMessage(params: {
    character: CombatCharacter;
    newLevel: number;
}): CombatMessage;
export declare function getMessageColor(messageType: CombatMessageType): string;
