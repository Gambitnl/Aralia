/**
 * @file handleCastSpellOutOfCombat.test.ts
 * Verifies the out-of-combat spellbook cast path in handleCastSpell:
 * slot pre-check, CAST_SPELL payload passthrough, healing/buff application,
 * cantrip handling, and the open character-sheet snapshot refresh.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCastSpell } from '../handleResourceActions';
import type { GameState, PlayerCharacter, Spell } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import { spellService } from '../../../services/SpellService';

vi.mock('../../../services/SpellService', () => ({
    spellService: {
        getSpellDetails: vi.fn(),
    },
}));

const getSpellDetails = vi.mocked(spellService.getSpellDetails);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const cureWounds = {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    description:
        'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.',
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
    effects: [
        {
            type: 'HEALING',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            healing: { dice: '2d8', isTemporaryHp: false },
        },
    ],
} as unknown as Spell;

const guidance = {
    id: 'guidance',
    name: 'Guidance',
    level: 0,
    description: 'Add 1d4 to one ability check of its choice.',
    components: { verbal: true, somatic: true, material: false },
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
} as unknown as Spell;

const makeCaster = (overrides: Record<string, unknown> = {}): PlayerCharacter =>
    ({
        id: 'pc-caster',
        name: 'Lyra',
        level: 2,
        hp: 10,
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
        spellSlots: { level_1: { current: 2, max: 3 } },
        spellbook: { cantrips: ['guidance'], preparedSpells: ['cure-wounds'], knownSpells: [] },
        ...overrides,
    }) as unknown as PlayerCharacter;

const makeAlly = (): PlayerCharacter =>
    ({
        id: 'pc-ally',
        name: 'Bram',
        hp: 4,
        maxHp: 12,
        statusEffects: [],
        race: { id: 'human', name: 'Human' },
        class: { id: 'fighter', name: 'Fighter' },
    }) as unknown as PlayerCharacter;

const makeGameState = (
    party: PlayerCharacter[],
    sheetOpenFor?: PlayerCharacter,
): GameState =>
    ({
        party,
        inventory: [],
        characterSheetModal: sheetOpenFor
            ? { isOpen: true, character: sheetOpenFor }
            : { isOpen: false, character: null },
    }) as unknown as GameState;

describe('handleCastSpell (out-of-combat spellbook path)', () => {
    let dispatched: AppAction[];
    let messages: string[];
    const dispatch = (action: AppAction) => dispatched.push(action);
    const addMessage = (text: string) => messages.push(text);

    beforeEach(() => {
        dispatched = [];
        messages = [];
        getSpellDetails.mockReset();
    });

    it('dispatches CAST_SPELL with the exact payload, then heals the chosen target', async () => {
        getSpellDetails.mockResolvedValue(cureWounds);
        const caster = makeCaster();
        const ally = makeAlly();
        const payload = {
            characterId: 'pc-caster',
            spellLevel: 1,
            spellId: 'cure-wounds',
            outOfCombat: { targetCharacterId: 'pc-ally' },
        };

        await handleCastSpell(dispatch, payload, makeGameState([caster, ally]), addMessage);

        const castAction = dispatched.find(a => a.type === 'CAST_SPELL');
        expect(castAction).toBeDefined();
        expect(castAction).toEqual({ type: 'CAST_SPELL', payload });

        const healAction = dispatched.find(a => a.type === 'MODIFY_PARTY_HEALTH');
        expect(healAction).toBeDefined();
        const healPayload = (healAction as Extract<AppAction, { type: 'MODIFY_PARTY_HEALTH' }>).payload;
        expect(healPayload.characterIds).toEqual(['pc-ally']);
        // 2d8 (2..16) + Wisdom modifier (+3).
        expect(healPayload.amount).toBeGreaterThanOrEqual(5);
        expect(healPayload.amount).toBeLessThanOrEqual(19);

        expect(messages.some(m => m.includes('casts Cure Wounds on Bram'))).toBe(true);
    });

    it('refuses to cast a leveled spell with no remaining slot (no CAST_SPELL dispatch)', async () => {
        getSpellDetails.mockResolvedValue(cureWounds);
        const drained = makeCaster({ spellSlots: { level_1: { current: 0, max: 3 } } });

        await handleCastSpell(
            dispatch,
            {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'cure-wounds',
                outOfCombat: { targetCharacterId: 'pc-caster' },
            },
            makeGameState([drained]),
            addMessage,
        );

        expect(dispatched).toHaveLength(0);
        expect(messages.some(m => m.includes('no level 1 spell slots left'))).toBe(true);
    });

    it('casts cantrips without any slot and applies the lasting buff to the target', async () => {
        getSpellDetails.mockResolvedValue(guidance);
        const caster = makeCaster({ spellSlots: undefined });
        const ally = makeAlly();

        await handleCastSpell(
            dispatch,
            {
                characterId: 'pc-caster',
                spellLevel: 0,
                spellId: 'guidance',
                outOfCombat: { targetCharacterId: 'pc-ally' },
            },
            makeGameState([caster, ally]),
            addMessage,
        );

        expect(dispatched.some(a => a.type === 'CAST_SPELL')).toBe(true);
        expect(dispatched.some(a => a.type === 'MODIFY_PARTY_HEALTH')).toBe(false);

        const buffAction = dispatched.find(a => a.type === 'APPLY_CHARACTER_STATUS_EFFECT');
        expect(buffAction).toBeDefined();
        const buffPayload = (
            buffAction as Extract<AppAction, { type: 'APPLY_CHARACTER_STATUS_EFFECT' }>
        ).payload;
        expect(buffPayload.characterId).toBe('pc-ally');
        expect(buffPayload.statusEffect).toMatchObject({
            name: 'Guidance',
            type: 'buff',
            duration: 10,
            source: 'Guidance',
            sourceCasterId: 'pc-caster',
        });
    });

    it('refreshes the open character sheet snapshot with the deducted slot', async () => {
        getSpellDetails.mockResolvedValue(cureWounds);
        const caster = makeCaster();
        const ally = makeAlly();

        await handleCastSpell(
            dispatch,
            {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'cure-wounds',
                outOfCombat: { targetCharacterId: 'pc-ally' },
            },
            makeGameState([caster, ally], caster),
            addMessage,
        );

        const sheetAction = dispatched.find(a => a.type === 'OPEN_CHARACTER_SHEET');
        expect(sheetAction).toBeDefined();
        const refreshed = (
            sheetAction as Extract<AppAction, { type: 'OPEN_CHARACTER_SHEET' }>
        ).payload;
        expect(refreshed.spellSlots?.level_1).toEqual({ current: 1, max: 3 });
        // Healing went to the ally, so the caster's HP is unchanged.
        expect(refreshed.hp).toBe(10);
    });

    it('does not resync the sheet when it is open for a different character', async () => {
        getSpellDetails.mockResolvedValue(cureWounds);
        const caster = makeCaster();
        const ally = makeAlly();

        await handleCastSpell(
            dispatch,
            {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'cure-wounds',
                outOfCombat: { targetCharacterId: 'pc-caster' },
            },
            makeGameState([caster, ally], ally),
            addMessage,
        );

        expect(dispatched.some(a => a.type === 'OPEN_CHARACTER_SHEET')).toBe(false);
        expect(dispatched.some(a => a.type === 'CAST_SPELL')).toBe(true);
    });

    it('leaves the plain (in-combat/legacy) path untouched when outOfCombat is absent', async () => {
        getSpellDetails.mockResolvedValue(cureWounds);
        const caster = makeCaster();

        await handleCastSpell(
            dispatch,
            { characterId: 'pc-caster', spellLevel: 1, spellId: 'cure-wounds' },
            makeGameState([caster]),
            addMessage,
        );

        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].type).toBe('CAST_SPELL');
    });
});
