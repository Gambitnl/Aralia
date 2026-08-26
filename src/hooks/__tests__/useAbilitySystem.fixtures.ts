import { CombatCharacter, Ability } from '../../types/combat';
import { ItemType } from '../../types';
import { Spell } from '../../types/spells';
import { Item } from '../../types';
import type { CombatState, SpellSlots } from '../../types/combat';
import type { ResourceVial } from '../../types/character';
import type { SpellCastingTrigger, SpellSchool } from '../../types/spells';
import type {
    ConditionName,
    EffectDuration,
    EffectTrigger,
    SpellEffect
} from '../../types/spellEffectTypes';
import type { DamageType } from '../../types/spellDamageMetadata';
import type { ExecutionResult } from '../../commands/base/CommandExecutor';

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
    type: ItemType.Weapon,
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

/* ==========================================================================
 * Shared builders for focused useAbilitySystem hook tests
 * --------------------------------------------------------------------------
 * Why these exist: each reaction test used to hand-roll a partial spell-slot
 * record, a partial command-execution result, and a partial spell or ability
 * literal, then widen it with `as unknown as ...` because the declared types
 * are complete records. Twelve `(lint-intent)` TODOs asked for these fixtures
 * by name. The casts also hid real drift from the declared contracts (a
 * missing `SpellCastingTrigger.timing`, a missing `Spell.subClasses`, a
 * `conditionName` string where `StatusCondition` was declared).
 *
 * What is preserved: every builder keeps the fields the ability hook actually
 * reads at the same values the old literals used, so swapping a literal for a
 * builder is a typing change first. Where a builder must add a field the old
 * literal omitted (the whole nine-level slot record, the required CombatState
 * keys, the required Ability keys) the default is inert for the reaction path
 * and is called out below.
 *
 * What remains deferred: these builders cover the reaction suite's needs. Other
 * useAbilitySystem test files still hand-roll their own literals; they can
 * adopt these incrementally rather than in one sweep.
 * ======================================================================== */

/** Every spell-slot level key, so a fixture can fill the whole declared record. */
const SPELL_SLOT_LEVELS: Array<keyof SpellSlots> = [
    'level_1', 'level_2', 'level_3', 'level_4', 'level_5',
    'level_6', 'level_7', 'level_8', 'level_9'
];

/**
 * Build a complete spell-slot record from the one or two levels a focused hook
 * test cares about.
 *
 * `SpellSlots` is a full `level_1..level_9` record, which is why every test
 * literal that named a single level had to cast. Unnamed levels are filled with
 * an empty vial (`current: 0`), which reads the same as "absent" to every slot
 * check in the ability hook while satisfying the declared type.
 *
 * A number is shorthand for a full vial at that size: `{ level_2: 1 }` means one
 * remaining of one maximum.
 */
export function makeSpellSlots(
    available: Partial<Record<keyof SpellSlots, number | ResourceVial>> = {}
): SpellSlots {
    const slots = {} as SpellSlots;

    for (const level of SPELL_SLOT_LEVELS) {
        const requested = available[level];

        if (typeof requested === 'number') {
            slots[level] = { current: requested, max: requested };
        } else {
            slots[level] = requested ?? { current: 0, max: 0 };
        }
    }

    return slots;
}

/**
 * Build a complete `CombatState` for a mocked command result.
 *
 * Only the required keys are defaulted. Optional state arrays (spell zones,
 * spell helpers, object impacts, and the rest) are deliberately left absent:
 * the ability hook compares them by identity against the state it passed in and
 * fires an update callback when they differ, so defaulting them to fresh `[]`
 * would wake callbacks the old partial literals never woke.
 */
export function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
    return {
        isActive: true,
        characters: [],
        turnState: {
            currentTurn: 1,
            turnOrder: [],
            currentCharacterId: null,
            phase: 'action',
            actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: [],
        activeLightSources: [],
        ...overrides
    };
}

/**
 * Minimal `CommandExecutor.execute` result builder.
 *
 * The reaction tests only ever vary the characters and the combat log, so the
 * first argument is the interesting slice of the final state and the second is
 * the rare execution-level override (a failed run, executed commands).
 */
export function makeCommandExecutionResult(
    finalState: Partial<CombatState> = {},
    overrides: Partial<Omit<ExecutionResult, 'finalState'>> = {}
): ExecutionResult {
    return {
        success: true,
        finalState: makeCombatState(finalState),
        executedCommands: [],
        ...overrides
    };
}

/** Attack metadata shared by a spell's casting trigger and its rider effect. */
export type ReactionAttackFilter = NonNullable<SpellCastingTrigger['attackFilter']>;

/** The payload a compact after-hit reaction spell lands on the triggering hit. */
export type ReactionSpellPayload =
    | { kind: 'damage'; dice: string; damageType: DamageType }
    | { kind: 'status'; conditionName: ConditionName; duration?: EffectDuration };

/**
 * Compact smite-style reaction spell: cast off a qualifying attack hit, payload
 * bound to that same hit.
 *
 * Note for readers comparing against the old literals: those omitted the
 * required `SpellCastingTrigger.timing` and `Spell.subClasses`, which is part of
 * why they needed a cast. Both are supplied here at their only sensible values
 * for an after-hit reaction; neither is read by the reaction bridge.
 */
export function makeAfterHitReactionSpell(spec: {
    id: string;
    name: string;
    level: number;
    school: SpellSchool;
    description: string;
    /** Attacks that may wake the spell. */
    castAttackFilter: ReactionAttackFilter;
    /** Attacks the rider payload itself accepts; defaults to the cast filter. */
    effectAttackFilter?: EffectTrigger['attackFilter'];
    payload: ReactionSpellPayload;
    classes?: string[];
}): Spell {
    const effectFilter = spec.effectAttackFilter ?? {
        attackType: spec.castAttackFilter.attackType,
        weaponType: spec.castAttackFilter.weaponType
    };

    const trigger: EffectTrigger = {
        type: 'on_attack_hit',
        frequency: 'once',
        consumption: 'first_hit',
        attackFilter: effectFilter
    };

    const effect: SpellEffect = spec.payload.kind === 'damage'
        ? {
            type: 'DAMAGE',
            damage: { dice: spec.payload.dice, type: spec.payload.damageType },
            trigger,
            condition: { type: 'always' }
        }
        : {
            type: 'STATUS_CONDITION',
            statusCondition: {
                name: spec.payload.conditionName,
                duration: spec.payload.duration ?? { type: 'rounds', value: 1 }
            },
            trigger,
            condition: { type: 'always' }
        };

    return {
        id: spec.id,
        name: spec.name,
        level: spec.level,
        school: spec.school,
        classes: spec.classes ?? ['Paladin'],
        subClasses: [],
        description: spec.description,
        castingTime: { value: 1, unit: 'reaction' },
        castingTrigger: {
            type: 'after_attack_hit',
            timing: 'immediate_after_event',
            requiredCost: 'reaction',
            targetBinding: 'triggering_attack_target',
            attackFilter: spec.castAttackFilter
        },
        range: { type: 'self', distance: 0 },
        components: { verbal: true, somatic: false, material: false },
        duration: { type: 'instantaneous', concentration: false },
        targeting: { type: 'single', range: 5, validTargets: ['enemies'] },
        effects: [effect]
    };
}

/**
 * Compact ordinary damaging spell, used as the *interrupted* spell in the
 * Counterspell tests. It is deliberately not a reaction: it costs an action and
 * carries one immediate damage row.
 */
export function makeDamagingSpell(spec: {
    id: string;
    name: string;
    level: number;
    school: SpellSchool;
    description: string;
    dice: string;
    damageType: DamageType;
    classes?: string[];
    rangeFeet?: number;
    targeting?: Spell['targeting'];
}): Spell {
    const rangeFeet = spec.rangeFeet ?? 150;

    return {
        id: spec.id,
        name: spec.name,
        level: spec.level,
        school: spec.school,
        classes: spec.classes ?? ['Wizard'],
        subClasses: [],
        description: spec.description,
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'ranged', distance: rangeFeet },
        components: { verbal: true, somatic: true, material: true },
        duration: { type: 'instantaneous', concentration: false },
        targeting: spec.targeting ?? {
            type: 'area',
            range: rangeFeet,
            areaOfEffect: { shape: 'Sphere', size: 20 },
            validTargets: ['point']
        },
        effects: [{
            type: 'DAMAGE',
            damage: { dice: spec.dice, type: spec.damageType },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }]
    };
}

/**
 * Spellbook-style ability button wrapping a spell, including reaction spells.
 *
 * `Ability` requires a description, cost, targeting, range, and effects that the
 * old inline literals all omitted. The defaults here mirror what the spell data
 * already says: a reaction-cast spell gets a reaction cost, anything else an
 * action cost, and the description is the spell's own. Every default is
 * overridable so a test that cares about a specific button shape can say so.
 */
export function makeSpellAbility(spec: {
    id: string;
    name: string;
    spell: Spell;
    overrides?: Partial<Ability>;
}): Ability {
    const isReactionCast = spec.spell.castingTime?.unit === 'reaction';

    return {
        id: spec.id,
        name: spec.name,
        description: spec.spell.description,
        type: 'spell',
        cost: isReactionCast
            ? { type: 'reaction', spellSlotLevel: spec.spell.level }
            : { type: 'action', spellSlotLevel: spec.spell.level },
        targeting: 'single_enemy',
        range: 60,
        effects: [],
        spell: spec.spell,
        ...spec.overrides
    };
}
