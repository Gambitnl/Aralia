/**
 * This test file protects future-attack rider registration.
 *
 * Rider spells register payloads that wait for a later attack. Some spells,
 * especially Lightning Arrow, register more than one rider during the same cast.
 * These tests make sure those payloads remain separate combat records so the
 * attack rider system can consume each one deliberately instead of merging them
 * through an accidental duplicate id.
 */
import { describe, expect, it } from 'vitest';
import { RegisterRiderCommand } from '../RegisterRiderCommand';
import type { CommandContext } from '../../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../../types/combat';
import type { SpellEffect } from '../../../types/spells';

// ============================================================================
// Rider Registration Fixtures
// ============================================================================
// These fixtures keep the test focused on the registration command. The actual
// attack-hit and attack-miss resolution is covered in the factory and rider
// system tests; this file only proves the stored rider records are safe to use.
// ============================================================================

const caster: CombatCharacter = {
    id: 'rider-caster',
    name: 'Rider Caster',
    team: 'player',
    position: { x: 0, y: 0 },
    currentHP: 20,
    maxHP: 20
} as unknown as CombatCharacter;

const target: CombatCharacter = {
    id: 'rider-target',
    name: 'Rider Target',
    team: 'enemy',
    position: { x: 1, y: 0 },
    currentHP: 20,
    maxHP: 20
} as unknown as CombatCharacter;

const createLightningArrowLikeEffect = (dice: string): SpellEffect => ({
    type: 'DAMAGE',
    trigger: {
        type: 'on_attack_hit',
        frequency: 'every_time',
        consumption: 'per_instance_hit_or_miss',
        attackFilter: {
            weaponType: 'ranged',
            attackType: 'weapon'
        }
    },
    condition: { type: 'always' },
    damage: {
        dice,
        type: 'Lightning'
    }
} as unknown as SpellEffect);

const createContext = (): CommandContext => ({
    spellId: 'lightning-arrow',
    spellName: 'Lightning Arrow',
    caster,
    targets: [caster],
    castAtLevel: 3,
    gameState: {} as never,
    effectDuration: { type: 'minutes', value: 1 }
} as unknown as CommandContext);

const createState = (): CombatState => ({
    isActive: true,
    characters: [caster, target],
    combatLog: []
} as unknown as CombatState);

// ============================================================================
// Same-Cast Multi-Rider Safety
// ============================================================================
// Lightning Arrow registers primary and burst payloads during one cast. If those
// riders share an id, later first-attack consumption cannot prove which payload
// was consumed. Distinct ids keep both payloads independently auditable.
// ============================================================================

describe('RegisterRiderCommand', () => {
    it('gives same-spell riders distinct ids when they are registered during one cast', () => {
        const primaryCommand = new RegisterRiderCommand(createLightningArrowLikeEffect('4d8'), createContext());
        const burstCommand = new RegisterRiderCommand(createLightningArrowLikeEffect('2d8'), createContext());

        const stateAfterPrimary = primaryCommand.execute(createState());
        const stateAfterBurst = burstCommand.execute(stateAfterPrimary);
        const updatedCaster = stateAfterBurst.characters.find(character => character.id === caster.id);
        const riderIds = updatedCaster?.riders?.map(rider => rider.id) ?? [];

        expect(riderIds).toHaveLength(2);
        expect(new Set(riderIds).size).toBe(2);
    });
});
