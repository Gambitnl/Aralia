/**
 * @file outOfCombatCasting.test.ts
 * Unit tests for the out-of-combat spellbook casting rules.
 */
import { describe, it, expect } from 'vitest';
import type { PlayerCharacter, Spell } from '../../../types';
import {
    applyPostCastToCharacter,
    buildOutOfCombatStatusEffect,
    findLowestAvailableSlotLevel,
    getOutOfCombatCastability,
    isSpellCastableOutOfCombat,
    rollOutOfCombatHealing,
    spellDurationToRounds,
    spellNeedsPartyTarget,
} from '../outOfCombatCasting';

// ---------------------------------------------------------------------------
// Minimal fixtures shaped like the live spell JSON corpus.
// ---------------------------------------------------------------------------

const makeSpell = (overrides: Record<string, unknown>): Spell =>
    ({
        id: 'test-spell',
        name: 'Test Spell',
        level: 1,
        school: 'Evocation',
        classes: [],
        subClasses: [],
        description: '',
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'touch' },
        components: { verbal: true, somatic: true, material: false },
        duration: { type: 'instantaneous', concentration: false },
        targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
        effects: [],
        ...overrides,
    }) as unknown as Spell;

const cureWounds = makeSpell({
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    description:
        'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.',
    targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
    effects: [
        {
            type: 'HEALING',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            healing: { dice: '2d8', isTemporaryHp: false },
        },
    ],
});

const fireBolt = makeSpell({
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    targeting: { type: 'single', range: 120, validTargets: ['creatures', 'objects'] },
    effects: [
        {
            type: 'DAMAGE',
            trigger: { type: 'immediate' },
            condition: { type: 'hit' },
            damage: { dice: '1d10', type: 'Fire' },
        },
    ],
});

const guidance = makeSpell({
    id: 'guidance',
    name: 'Guidance',
    level: 0,
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
    targeting: { type: 'single', range: 5, validTargets: ['creatures', 'allies'] },
    effects: [
        {
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Add 1d4 to one ability check.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
});

const mageArmor = makeSpell({
    id: 'mage-armor',
    name: 'Mage Armor',
    level: 1,
    duration: { type: 'timed', value: 8, unit: 'hour', concentration: false },
    targeting: { type: 'single', range: 0, validTargets: ['allies'] },
    effects: [
        {
            type: 'DEFENSIVE',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
});

const detectMagic = makeSpell({
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 1,
    duration: { type: 'timed', value: 10, unit: 'minute', concentration: true },
    targeting: { type: 'area', range: 0, validTargets: ['self'] },
    effects: [
        {
            type: 'UTILITY',
            utilityType: 'sensory',
            description: 'Sense magic within 30 feet.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
});

// Bless-like: unconditional attack-roll buff on allies.
const bless = makeSpell({
    id: 'bless',
    name: 'Bless',
    level: 1,
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
    targeting: { type: 'multi', range: 30, maxTargets: 3, validTargets: ['creatures'] },
    effects: [
        {
            type: 'ATTACK_ROLL_MODIFIER',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
});

// Save-gated control spell (Charm Person-like): must NOT be castable here.
const charmLike = makeSpell({
    id: 'charm-person',
    name: 'Charm Person',
    level: 1,
    targeting: { type: 'single', range: 30, validTargets: ['creatures'] },
    effects: [
        {
            type: 'STATUS_CONDITION',
            trigger: { type: 'immediate' },
            condition: { type: 'save', saveType: 'Wisdom' },
            statusCondition: { name: 'Charmed', duration: { type: 'special' } },
        },
    ],
});

const makeCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter =>
    ({
        id: 'pc-1',
        name: 'Lyra',
        level: 2,
        hp: 8,
        maxHp: 16,
        statusEffects: [],
        finalAbilityScores: {
            Strength: 10,
            Dexterity: 12,
            Constitution: 12,
            Intelligence: 10,
            Wisdom: 16,
            Charisma: 10,
        },
        class: {
            id: 'cleric',
            name: 'Cleric',
            spellcasting: { ability: 'Wisdom', knownCantrips: 3, knownSpellsL1: 4, spellList: [] },
        },
        race: { id: 'human', name: 'Human' },
        spellSlots: {
            level_1: { current: 2, max: 3 },
        },
        spellbook: { cantrips: ['guidance'], preparedSpells: ['cure-wounds'], knownSpells: [] },
        ...overrides,
    }) as unknown as PlayerCharacter;

// ---------------------------------------------------------------------------
// Castability predicate
// ---------------------------------------------------------------------------

describe('isSpellCastableOutOfCombat', () => {
    it('allows healing spells (Cure Wounds)', () => {
        expect(isSpellCastableOutOfCombat(cureWounds)).toBe(true);
    });

    it('allows utility cantrips (Guidance) and self utility (Detect Magic)', () => {
        expect(isSpellCastableOutOfCombat(guidance)).toBe(true);
        expect(isSpellCastableOutOfCombat(detectMagic)).toBe(true);
    });

    it('allows defensive buffs (Mage Armor) and unconditional attack buffs (Bless)', () => {
        expect(isSpellCastableOutOfCombat(mageArmor)).toBe(true);
        expect(isSpellCastableOutOfCombat(bless)).toBe(true);
    });

    it('rejects damage spells even when they are cantrips (Fire Bolt)', () => {
        expect(isSpellCastableOutOfCombat(fireBolt)).toBe(false);
    });

    it('rejects save-gated control spells (Charm Person)', () => {
        expect(isSpellCastableOutOfCombat(charmLike)).toBe(false);
    });

    it('rejects spells with an explicit attack type', () => {
        const attackSpell = makeSpell({
            ...cureWounds,
            attackType: 'melee_spell_attack',
        } as unknown as Record<string, unknown>);
        expect(isSpellCastableOutOfCombat(attackSpell)).toBe(false);
    });

    it('rejects spells with no executable effects', () => {
        expect(isSpellCastableOutOfCombat(makeSpell({ effects: [] }))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Slot availability
// ---------------------------------------------------------------------------

describe('findLowestAvailableSlotLevel', () => {
    it('returns the spell level when a slot of that level remains', () => {
        expect(findLowestAvailableSlotLevel(makeCharacter().spellSlots, 1)).toBe(1);
    });

    it('falls up to the next level with a remaining slot (upcast)', () => {
        const slots = {
            level_1: { current: 0, max: 3 },
            level_2: { current: 1, max: 2 },
        } as unknown as PlayerCharacter['spellSlots'];
        expect(findLowestAvailableSlotLevel(slots, 1)).toBe(2);
    });

    it('returns null when no slot of the level or higher remains', () => {
        const slots = {
            level_1: { current: 0, max: 3 },
        } as unknown as PlayerCharacter['spellSlots'];
        expect(findLowestAvailableSlotLevel(slots, 1)).toBeNull();
        expect(findLowestAvailableSlotLevel(undefined, 1)).toBeNull();
    });
});

describe('getOutOfCombatCastability', () => {
    it('cantrips are always castable at level 0', () => {
        expect(getOutOfCombatCastability(makeCharacter(), guidance)).toEqual({
            allowed: true,
            castLevel: 0,
        });
    });

    it('leveled spells consume the lowest available slot', () => {
        expect(getOutOfCombatCastability(makeCharacter(), cureWounds)).toEqual({
            allowed: true,
            castLevel: 1,
        });
    });

    it('is blocked with a clear reason when no slots remain', () => {
        const drained = makeCharacter({
            spellSlots: { level_1: { current: 0, max: 3 } } as unknown as PlayerCharacter['spellSlots'],
        });
        const result = getOutOfCombatCastability(drained, cureWounds);
        expect(result.allowed).toBe(false);
        expect(result.castLevel).toBeNull();
        expect(result.reason).toBe('No level 1+ spell slots remaining.');
    });

    it('is blocked for combat spells regardless of slots', () => {
        const result = getOutOfCombatCastability(makeCharacter(), fireBolt);
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/combat/i);
    });
});

// ---------------------------------------------------------------------------
// Target requirements
// ---------------------------------------------------------------------------

describe('spellNeedsPartyTarget', () => {
    it('single/multi creature or ally targeting needs a target choice', () => {
        expect(spellNeedsPartyTarget(cureWounds)).toBe(true);
        expect(spellNeedsPartyTarget(guidance)).toBe(true);
        expect(spellNeedsPartyTarget(mageArmor)).toBe(true);
        expect(spellNeedsPartyTarget(bless)).toBe(true);
    });

    it('self/area spells cast directly', () => {
        expect(spellNeedsPartyTarget(detectMagic)).toBe(false);
    });

    it('combat spells never ask for a party target', () => {
        expect(spellNeedsPartyTarget(fireBolt)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Healing rolls
// ---------------------------------------------------------------------------

describe('rollOutOfCombatHealing', () => {
    it('rolls the healing dice and adds the spellcasting modifier when the text calls for it', () => {
        // rng always 0 -> each d8 rolls 1 -> 2d8 = 2, +3 Wisdom modifier = 5.
        const healed = rollOutOfCombatHealing(cureWounds, makeCharacter(), () => 0);
        expect(healed).toBe(5);
    });

    it('omits the modifier when the spell text does not mention it', () => {
        const plainHeal = makeSpell({
            ...cureWounds,
            description: 'A creature you touch regains 2d8 Hit Points.',
        } as unknown as Record<string, unknown>);
        expect(rollOutOfCombatHealing(plainHeal, makeCharacter(), () => 0)).toBe(2);
    });

    it('returns 0 for non-healing spells and skips temporary-HP effects', () => {
        expect(rollOutOfCombatHealing(guidance, makeCharacter(), () => 0)).toBe(0);
        const falseLife = makeSpell({
            effects: [
                {
                    type: 'HEALING',
                    trigger: { type: 'immediate' },
                    condition: { type: 'always' },
                    healing: { dice: '2d4+4', isTemporaryHp: true },
                },
            ],
        });
        expect(rollOutOfCombatHealing(falseLife, makeCharacter(), () => 0)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Lasting effects
// ---------------------------------------------------------------------------

describe('spellDurationToRounds', () => {
    it('converts timed durations (1 round = 6 seconds)', () => {
        expect(spellDurationToRounds(guidance.duration)).toBe(10); // 1 minute
        expect(spellDurationToRounds(mageArmor.duration)).toBe(4800); // 8 hours
    });

    it('returns null for instantaneous spells', () => {
        expect(spellDurationToRounds(cureWounds.duration)).toBeNull();
    });
});

describe('buildOutOfCombatStatusEffect', () => {
    it('creates a buff record with the engine de-dup keys for lasting spells', () => {
        const effect = buildOutOfCombatStatusEffect(mageArmor, 'pc-1');
        expect(effect).not.toBeNull();
        expect(effect).toMatchObject({
            name: 'Mage Armor',
            type: 'buff',
            duration: 4800,
            source: 'Mage Armor',
            sourceCasterId: 'pc-1',
        });
    });

    it('returns null for instantaneous healing spells', () => {
        expect(buildOutOfCombatStatusEffect(cureWounds, 'pc-1')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Character-sheet snapshot refresh
// ---------------------------------------------------------------------------

describe('applyPostCastToCharacter', () => {
    it('decrements the cast-level slot and caps self-healing at max HP', () => {
        const updated = applyPostCastToCharacter(makeCharacter(), 1, { selfHealing: 20 });
        expect(updated.spellSlots?.level_1).toEqual({ current: 1, max: 3 });
        expect(updated.hp).toBe(16); // capped at maxHp
    });

    it('leaves slots untouched for cantrips and replaces same-source effects', () => {
        const existing = buildOutOfCombatStatusEffect(guidance, 'pc-1')!;
        const character = makeCharacter({ statusEffects: [existing] } as Partial<PlayerCharacter>);
        const recast = buildOutOfCombatStatusEffect(guidance, 'pc-1')!;
        const updated = applyPostCastToCharacter(character, 0, { statusEffect: recast });
        expect(updated.spellSlots?.level_1).toEqual({ current: 2, max: 3 });
        expect(updated.statusEffects).toHaveLength(1);
        expect(updated.statusEffects[0].source).toBe('Guidance');
    });
});
