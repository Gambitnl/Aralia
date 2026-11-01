/**
 * @file getMaxPreparedSpells.test.ts
 * Tests for getMaxPreparedSpells utility across classes and levels (2024 PHB rules).
 */
import { describe, it, expect } from 'vitest';
import { getMaxPreparedSpells } from '../getMaxPreparedSpells';
import type { PlayerCharacter } from '../../../types';

function createMockCharacter(classId: string, level: number, subclassId?: string): PlayerCharacter {
    return {
        id: 'test-char',
        name: 'Test Character',
        level,
        class: {
            id: classId,
            name: classId,
            subclass: subclassId ? { id: subclassId, name: subclassId } : undefined,
        },
    } as unknown as PlayerCharacter;
}

describe('getMaxPreparedSpells', () => {
    it('uses the campaign edition and actual class level for daily preparation', () => {
        const paladin = {...createMockCharacter('paladin', 10), classLevels: {paladin: 2, wizard: 8},
            finalAbilityScores: {Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 16}};
        expect(getMaxPreparedSpells(paladin, '2024')).toBe(3);
        expect(getMaxPreparedSpells(paladin, '2014')).toBe(4);
        expect(getMaxPreparedSpells(createMockCharacter('paladin', 1), '2014')).toBe(0);
        expect(getMaxPreparedSpells(createMockCharacter('ranger', 5), '2014')).toBeNull();
    });
    describe('Warlock (Pact Magic)', () => {
        // Canonical 2024 PHB progression for Warlock:
        // [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
        const expectedWarlockProgression = [
            2, 3, 4, 5, 6, 7, 8, 9, 10, 10,
            11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
        ];

        it('returns correct prepared spells for each level from 1 to 20', () => {
            expectedWarlockProgression.forEach((expected, index) => {
                const level = index + 1;
                const char = createMockCharacter('warlock', level);
                expect(getMaxPreparedSpells(char)).toBe(expected);
            });
        });

        it('specifically enforces level 10 and above progression', () => {
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 9))).toBe(10);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 10))).toBe(10);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 11))).toBe(11);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 12))).toBe(11);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 13))).toBe(12);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 14))).toBe(12);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 15))).toBe(13);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 16))).toBe(13);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 17))).toBe(14);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 18))).toBe(14);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 19))).toBe(15);
            expect(getMaxPreparedSpells(createMockCharacter('warlock', 20))).toBe(15);
        });
    });

    describe('Other casters and non-casters', () => {
        it('returns correct prepared spells for Wizard level 1 and 20', () => {
            expect(getMaxPreparedSpells(createMockCharacter('wizard', 1))).toBe(4);
            expect(getMaxPreparedSpells(createMockCharacter('wizard', 20))).toBe(25);
        });

        it('returns null for non-caster classes without spellcasting subclass', () => {
            expect(getMaxPreparedSpells(createMockCharacter('fighter', 5))).toBeNull();
            expect(getMaxPreparedSpells(createMockCharacter('barbarian', 3))).toBeNull();
        });

        it('returns spell slots for third casters with appropriate subclass', () => {
            expect(getMaxPreparedSpells(createMockCharacter('fighter', 2, 'eldritch_knight'))).toBeNull();
            expect(getMaxPreparedSpells(createMockCharacter('fighter', 3, 'eldritch_knight'))).toBe(3);
        });
    });
});
