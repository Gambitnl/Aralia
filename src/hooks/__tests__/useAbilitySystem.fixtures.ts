import { CombatCharacter, Ability } from '../../types/combat';
import { Spell } from '../../types/spells';
import { Item } from '../../types';

/**
 * Shared fixtures for the useAbilitySystem hook test suite (split by describe block).
 * Move-only extraction from the former single useAbilitySystem.test.ts.
 */
// Mock Data Setup
export const shieldSpell: Spell = {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['Wizard'],
    description: 'Shield spell',
    castingTime: { value: 1, unit: 'reaction' },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'timed', value: 1, unit: 'round', concentration: false },
    targeting: { type: 'self', validTargets: ['self'] },
    effects: [{
        type: 'DEFENSIVE',
        defenseType: 'ac_bonus',
        acBonus: 5,
        duration: { type: 'rounds', value: 1 },
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        reactionTrigger: { event: 'when_hit' }
    }]
} as Spell;

export const attacker: CombatCharacter = {
    id: 'attacker',
    name: 'Attacker',
    team: 'enemy',
    position: { x: 0, y: 0 },
    currentHP: 10,
    maxHP: 10,
    stats: { strength: 18, dexterity: 10 },
    abilities: [],
    actionEconomy: { reaction: { remaining: 1, used: false }, action: {}, bonusAction: {}, movement: {} },
    statusEffects: [],
    level: 1
} as unknown as CombatCharacter;

export const defender: CombatCharacter = {
    id: 'defender',
    name: 'Defender',
    team: 'player',
    position: { x: 1, y: 0 },
    currentHP: 10,
    maxHP: 10,
    armorClass: 10, // Low AC to ensure hit
    stats: { dexterity: 10 },
    abilities: [{ id: 'shield-ab', spell: shieldSpell, type: 'spell' } as unknown],
    actionEconomy: { reaction: { remaining: 1, used: false }, action: {}, bonusAction: {}, movement: {} },
    statusEffects: [],
    level: 1
} as unknown as CombatCharacter;

export const swordItem: Item = {
    id: 'sword',
    name: 'Longsword',
    description: 'A sharp blade',
    type: 'weapon',
    damageDice: '1d8',
    damageType: 'Slashing',
    properties: ['Versatile'],
    cost: '15 gp',
    weight: 3,
    isMartial: true
};

export const basicAttack: Ability = {
    id: 'attack',
    name: 'Attack',
    description: 'Basic attack',
    type: 'attack',
    range: 5,
    targeting: 'single_enemy',
    effects: [], // damage
    cost: { type: 'action' },
    isProficient: true,
    weapon: swordItem
} as Ability;
