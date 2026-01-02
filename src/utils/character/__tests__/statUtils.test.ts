
import { describe, it, expect } from 'vitest';
import { calculateArmorClass, calculateFinalAbilityScores, calculatePassiveScore } from '../statUtils';
import { createMockPlayerCharacter } from '../../core/factories';
import { ActiveEffect } from '@/types/combat';
import { Item } from '@/types';

describe('statUtils', () => {
    describe('calculateArmorClass', () => {
        it('calculates unarmored AC correctly (10 + Dex)', () => {
            const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: undefined,
                    OffHand: undefined
                }
            });
            // 10 + 2 (Dex) = 12
            expect(calculateArmorClass(char)).toBe(12);
        });

        it('calculates armored AC correctly', () => {
            const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: {
                        id: 'leather_armor',
                        name: 'Leather Armor',
                        type: 'armor',
                        description: '',
                        armorCategory: 'Light',
                        baseArmorClass: 11,
                        addsDexterityModifier: true
                    },
                    OffHand: undefined
                }
            });
            // 11 + 2 (Dex) = 13
            expect(calculateArmorClass(char)).toBe(13);
        });

        it('respects Max Dex Bonus (Medium Armor)', () => {
            const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 18, // +4 Mod
                    Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: {
                        id: 'scale_mail',
                        name: 'Scale Mail',
                        type: 'armor',
                        description: '',
                        armorCategory: 'Medium',
                        baseArmorClass: 14,
                        addsDexterityModifier: true,
                        maxDexterityBonus: 2
                    },
                    OffHand: undefined
                }
            });
            // 14 + min(4, 2) = 16
            expect(calculateArmorClass(char)).toBe(16);
        });

        it('calculates Shield bonus correctly', () => {
            const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: undefined,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
                        description: '',
                        armorCategory: 'Shield',
                        armorClassBonus: 2
                    }
                }
            });
            // 10 + 2 (Dex) + 2 (Shield) = 14
            expect(calculateArmorClass(char)).toBe(14);
        });

        it('calculates Barbarian Unarmored Defense (10 + Dex + Con)', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'barbarian', name: 'Barbarian', description: '', hitDie: 12, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 16, // +3
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: { Torso: undefined, OffHand: undefined }
            });
            // 10 + 2 (Dex) + 3 (Con) = 15
            expect(calculateArmorClass(char)).toBe(15);
        });

        it('Barbarian Unarmored Defense works with Shield', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'barbarian', name: 'Barbarian', description: '', hitDie: 12, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 16, // +3
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: undefined,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
                        description: '',
                        armorCategory: 'Shield',
                        armorClassBonus: 2
                    }
                }
            });
            // 10 + 2 (Dex) + 3 (Con) + 2 (Shield) = 17
            expect(calculateArmorClass(char)).toBe(17);
        });

        it('calculates Monk Unarmored Defense (10 + Dex + Wis)', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk', description: '', hitDie: 8, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 16, // +3
                    Charisma: 10
                },
                equippedItems: { Torso: undefined, OffHand: undefined }
            });
            // 10 + 2 (Dex) + 3 (Wis) = 15
            expect(calculateArmorClass(char)).toBe(15);
        });

        it('Monk Unarmored Defense fails with Shield', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk', description: '', hitDie: 8, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 16, // +3
                    Charisma: 10
                },
                equippedItems: {
                    Torso: undefined,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
                        description: '',
                        armorCategory: 'Shield',
                        armorClassBonus: 2
                    }
                }
            });
            // 10 + 2 (Dex) + 0 (No Wis with Shield) + 2 (Shield) = 14
            // (Strictly 5e Rules: Monks lose Unarmored Defense if using a shield)
            expect(calculateArmorClass(char)).toBe(14);
        });

        it('handles Mage Armor vs Unarmored Defense (should take higher)', () => {
            // Case 1: Unarmored Defense is better
            // Monk: Dex +3, Wis +3. AC = 10+3+3 = 16.
            // Mage Armor: 13 + Dex(+3) = 16. Same.
            // Let's make Wis +4 (AC 17) vs Mage Armor (AC 16)
            const monkBetter = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk', description: '', hitDie: 8, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10,
                    Dexterity: 16, // +3
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 18, // +4
                    Charisma: 10
                },
                equippedItems: { Torso: undefined, OffHand: undefined }
            });

            const mageArmorEffect: ActiveEffect = {
                id: 'mage_armor',
                name: 'Mage Armor',
                spellId: 'mage_armor',
                casterId: 'tester',
                source: 'spell',
                appliedTurn: 0,
                sourceName: 'Mage Armor',
                type: 'buff',
                duration: { type: 'minutes', value: 480 },
                startTime: Date.now(),
                mechanics: { acBonus: 3 }
            };

            // Monk Unarmored: 10 + 3 + 4 = 17
            // Mage Armor: 13 + 3 = 16
            // Should be 17
            expect(calculateArmorClass(monkBetter, [mageArmorEffect])).toBe(17);


            // Case 2: Mage Armor is better
            // Monk: Dex +3, Wis +1. AC = 10+3+1 = 14.
            // Mage Armor: 13 + 3 = 16.
            const mageArmorBetter = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk', description: '', hitDie: 8, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
                finalAbilityScores: {
                    Strength: 10,
                    Dexterity: 16, // +3
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 12, // +1
                    Charisma: 10
                },
                equippedItems: { Torso: undefined, OffHand: undefined }
            });

            // Monk Unarmored: 10 + 3 + 1 = 14
            // Mage Armor: 13 + 3 = 16
            // Should be 16
            expect(calculateArmorClass(mageArmorBetter, [mageArmorEffect])).toBe(16);
        });

        it('prevents Mage Armor if wearing Real Armor', () => {
             const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: {
                        id: 'leather',
                        name: 'Leather Armor',
                        description: '',
                        type: 'armor',
                        armorCategory: 'Light',
                        baseArmorClass: 11,
                        addsDexterityModifier: true
                    },
                    OffHand: undefined
                }
            });

            const mageArmorEffect: ActiveEffect = {
                id: 'mage_armor',
                name: 'Mage Armor',
                spellId: 'mage_armor',
                casterId: 'tester',
                source: 'spell',
                appliedTurn: 0,
                sourceName: 'Mage Armor',
                type: 'buff',
                duration: { type: 'minutes', value: 480 },
                startTime: Date.now(),
                mechanics: {
                    acBonus: 3 // simplified; base 13 vs default 10
                }
            };

            // Wearing Armor: 11 + 2 = 13.
            // Mage Armor (if allowed): 13 + 2 = 15.
            // But wearing armor suppresses Mage Armor effects usually.
            // In 5e, "The spell ends if the target dons armor".
            // Implementation: calculateArmorClass filters out set_base_ac if armor is present.
            expect(calculateArmorClass(char, [mageArmorEffect])).toBe(13);
        });
    });

    describe('calculateFinalAbilityScores (Ability Score Overrides)', () => {
        it('applies additive bonuses correctly', () => {
            const char = createMockPlayerCharacter({
                finalAbilityScores: {
                    Strength: 10, Dexterity: 10, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                }
            });

            // Item that adds +2 Strength (e.g. Manual of Gainful Exercise)
            const item: Item = {
                id: 'book_str', name: 'Manual of Str', description: 'Adds +2 Str',
                type: 'accessory',
                statBonuses: { Strength: 2 }
            };

            const result = calculateFinalAbilityScores(
                char.finalAbilityScores,
                char.race,
                { Ring1: item }
            );

            // 10 + 2 = 12
            expect(result.Strength).toBe(12);
        });

        it('handles Set Score items (like Gauntlets of Ogre Power)', () => {
            const char = createMockPlayerCharacter({
                 finalAbilityScores: {
                    Strength: 8, Dexterity: 10, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                }
            });

            const gauntlets: Item = {
                id: 'gauntlets', name: 'Gauntlets of Ogre Power',
                description: 'Sets Str to 19',
                type: 'accessory',
                statOverrides: { Strength: 19 } // Now using the correct field
            };

            const result = calculateFinalAbilityScores(
                char.finalAbilityScores,
                char.race,
                { Hands: gauntlets }
            );

            // 8 is less than 19, so it should become 19.
            expect(result.Strength).toBe(19);
        });

        it('ignores Set Score items if base score is higher', () => {
            const char = createMockPlayerCharacter({
                 finalAbilityScores: {
                    Strength: 20, Dexterity: 10, Constitution: 10,
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                }
            });

            const gauntlets: Item = {
                id: 'gauntlets', name: 'Gauntlets of Ogre Power',
                description: 'Sets Str to 19',
                type: 'accessory',
                statOverrides: { Strength: 19 }
            };

            const result = calculateFinalAbilityScores(
                char.finalAbilityScores,
                char.race,
                { Hands: gauntlets }
            );

            // 20 is greater than 19, so it should remain 20.
            expect(result.Strength).toBe(20);
        });
    });

    describe('calculatePassiveScore', () => {
        it('calculates base passive score correctly (10 + mod)', () => {
            // Wisdom 10 (+0) -> 10 + 0 = 10
            expect(calculatePassiveScore(0)).toBe(10);
            // Wisdom 14 (+2) -> 10 + 2 = 12
            expect(calculatePassiveScore(2)).toBe(12);
            // Wisdom 8 (-1) -> 10 - 1 = 9
            expect(calculatePassiveScore(-1)).toBe(9);
        });

        it('adds proficiency bonus correctly', () => {
            // Wis +2, Prof +2 -> 10 + 2 + 2 = 14
            expect(calculatePassiveScore(2, 2)).toBe(14);
        });

        it('handles advantage (+5)', () => {
            // Wis +2, Prof +2, Advantage -> 14 + 5 = 19
            expect(calculatePassiveScore(2, 2, 'advantage')).toBe(19);
        });

        it('handles disadvantage (-5)', () => {
            // Wis +2, Prof +2, Disadvantage -> 14 - 5 = 9
            expect(calculatePassiveScore(2, 2, 'disadvantage')).toBe(9);
        });
    });
});
