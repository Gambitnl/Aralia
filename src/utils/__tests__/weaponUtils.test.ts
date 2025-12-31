import { describe, it, expect } from 'vitest';
import { isWeaponMartial, isWeaponProficient } from '../weaponUtils';
import { createMockPlayerCharacter, createMockItem } from '../factories';
// TODO(lint-intent): 'Item' is unused in this test; use it in the assertion path or remove it.
import { Item as _Item } from '@/types/items';

describe('weaponUtils', () => {
    describe('isWeaponMartial', () => {
        it('should return true for weapons with "Martial" category', () => {
            const weapon = createMockItem({
                type: 'weapon',
                category: 'Martial Weapons'
            });
            expect(isWeaponMartial(weapon)).toBe(true);
        });

        it('should return false for weapons with "Simple" category', () => {
            const weapon = createMockItem({
                type: 'weapon',
                category: 'Simple Weapons'
            });
            expect(isWeaponMartial(weapon)).toBe(false);
        });

        it('should be case insensitive', () => {
            const weapon = createMockItem({
                type: 'weapon',
                category: 'martial weapons'
            });
            expect(isWeaponMartial(weapon)).toBe(true);
        });

        it('should return false for non-weapon items', () => {
            const potion = createMockItem({
                type: 'potion',
                category: 'Consumable'
            });
            expect(isWeaponMartial(potion)).toBe(false);
        });

        it('should return false for null inputs', () => {
            // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
            // @ts-expect-error - null input for coverage
            expect(isWeaponMartial(null)).toBe(false);
            // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
            // @ts-expect-error - undefined input for coverage
            expect(isWeaponMartial(undefined)).toBe(false);
        });

        it('should default to Simple (false) if category is missing', () => {
            const weapon = createMockItem({
                type: 'weapon',
                // category is missing
            });
            expect(isWeaponMartial(weapon)).toBe(false);
        });

        it('should prioritize "martial" keyword if category contains both', () => {
            const weapon = createMockItem({
                type: 'weapon',
                category: 'Simple Martial Hybrid'
            });
            expect(isWeaponMartial(weapon)).toBe(true);
        });
    });

    describe('isWeaponProficient', () => {
        it('should return true if character has "Simple weapons" proficiency and weapon is simple', () => {
            const character = createMockPlayerCharacter();
            // Directly modify the deep object as factory might not support deep partial merging perfectly for nested props yet
            character.class.weaponProficiencies = ['Simple weapons'];

            const simpleWeapon = createMockItem({
                type: 'weapon',
                category: 'Simple Weapons',
                name: 'Club'
            });

            expect(isWeaponProficient(character, simpleWeapon)).toBe(true);
        });

        it('should return true if character has "Martial weapons" proficiency and weapon is martial', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Martial weapons'];

            const martialWeapon = createMockItem({
                type: 'weapon',
                category: 'Martial Weapons',
                name: 'Longsword'
            });

            expect(isWeaponProficient(character, martialWeapon)).toBe(true);
        });

        it('should return false if character only has "Simple weapons" and weapon is martial', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Simple weapons'];

            const martialWeapon = createMockItem({
                type: 'weapon',
                category: 'Martial Weapons',
                name: 'Greatsword'
            });

            expect(isWeaponProficient(character, martialWeapon)).toBe(false);
        });

        it('should return true for specific weapon proficiency', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Longsword', 'Dagger'];

            const longsword = createMockItem({
                type: 'weapon',
                category: 'Martial Weapons',
                name: 'Longsword'
            });

            expect(isWeaponProficient(character, longsword)).toBe(true);
        });

        it('should handle plural/singular mismatch (Proficiency: Plural, Item: Singular)', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Longswords'];

            const longsword = createMockItem({
                type: 'weapon',
                name: 'Longsword'
            });

            expect(isWeaponProficient(character, longsword)).toBe(true);
        });

        it('should handle plural/singular mismatch (Proficiency: Singular, Item: Plural - unlikely but tested)', () => {
            // Note: The code lowercases and removes trailing 's' from both.
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Longsword'];

            const longswords = createMockItem({
                type: 'weapon',
                name: 'Longswords'
            });

            expect(isWeaponProficient(character, longswords)).toBe(true);
        });

        it('should return false for null character or weapon', () => {
            const character = createMockPlayerCharacter();
            const weapon = createMockItem({ type: 'weapon' });
            // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
            // @ts-expect-error - null character coverage
            expect(isWeaponProficient(null, weapon)).toBe(false);
            // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
            // @ts-expect-error - null weapon coverage
            expect(isWeaponProficient(character, null)).toBe(false);
        });

        it('should return false if weapon is not of type "weapon"', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['Simple weapons'];

            const potion = createMockItem({
                type: 'potion',
                category: 'Simple Weapons' // Even if category matches, type must be weapon
            });

            expect(isWeaponProficient(character, potion)).toBe(false);
        });

        it('should be case insensitive for specific proficiencies', () => {
            const character = createMockPlayerCharacter();
            character.class.weaponProficiencies = ['longsword']; // lowercase in char sheet

            const weapon = createMockItem({
                type: 'weapon',
                name: 'Longsword' // Title case in item
            });

            expect(isWeaponProficient(character, weapon)).toBe(true);
        });

        it('should handle missing class data gracefully', () => {
             const character = createMockPlayerCharacter();
             // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
             // @ts-expect-error - simulating data corruption
             character.class = undefined;
             const weapon = createMockItem({ type: 'weapon' });
             expect(isWeaponProficient(character, weapon)).toBe(false);
        });
    });
});
