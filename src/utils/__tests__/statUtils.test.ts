
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateArmorClass, calculateFinalAbilityScores } from '../statUtils';
import { createMockPlayerCharacter } from '../factories';
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
                    Torso: null,
                    OffHand: null
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
                        armorCategory: 'Light',
                        baseArmorClass: 11,
                        addsDexterityModifier: true
                    },
                    OffHand: null
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
                        armorCategory: 'Medium',
                        baseArmorClass: 14,
                        addsDexterityModifier: true,
                        maxDexterityBonus: 2
                    },
                    OffHand: null
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
                    Torso: null,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
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
                class: { id: 'barbarian', name: 'Barbarian' },
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 16, // +3
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: { Torso: null, OffHand: null }
            });
            // 10 + 2 (Dex) + 3 (Con) = 15
            expect(calculateArmorClass(char)).toBe(15);
        });

        it('Barbarian Unarmored Defense works with Shield', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'barbarian', name: 'Barbarian' },
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 16, // +3
                    Intelligence: 10, Wisdom: 10, Charisma: 10
                },
                equippedItems: {
                    Torso: null,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
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
                class: { id: 'monk', name: 'Monk' },
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 16, // +3
                    Charisma: 10
                },
                equippedItems: { Torso: null, OffHand: null }
            });
            // 10 + 2 (Dex) + 3 (Wis) = 15
            expect(calculateArmorClass(char)).toBe(15);
        });

        it('Monk Unarmored Defense fails with Shield', () => {
            const char = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk' },
                finalAbilityScores: {
                    Strength: 10, Dexterity: 14, // +2
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 16, // +3
                    Charisma: 10
                },
                equippedItems: {
                    Torso: null,
                    OffHand: {
                        id: 'shield',
                        name: 'Shield',
                        type: 'armor',
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
                class: { id: 'monk', name: 'Monk' },
                finalAbilityScores: {
                    Strength: 10,
                    Dexterity: 16, // +3
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 18, // +4
                    Charisma: 10
                },
                equippedItems: { Torso: null, OffHand: null }
            });

            const mageArmorEffect: ActiveEffect = {
                id: 'mage_armor',
                name: 'Mage Armor',
                type: 'set_base_ac',
                value: 13,
                duration: 28800,
                startTime: Date.now()
            };

            // Monk Unarmored: 10 + 3 + 4 = 17
            // Mage Armor: 13 + 3 = 16
            // Should be 17
            expect(calculateArmorClass(monkBetter, [mageArmorEffect])).toBe(17);


            // Case 2: Mage Armor is better
            // Monk: Dex +3, Wis +1. AC = 10+3+1 = 14.
            // Mage Armor: 13 + 3 = 16.
            const mageArmorBetter = createMockPlayerCharacter({
                class: { id: 'monk', name: 'Monk' },
                finalAbilityScores: {
                    Strength: 10,
                    Dexterity: 16, // +3
                    Constitution: 10,
                    Intelligence: 10,
                    Wisdom: 12, // +1
                    Charisma: 10
                },
                equippedItems: { Torso: null, OffHand: null }
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
                        id: 'leather', type: 'armor', armorCategory: 'Light',
                        baseArmorClass: 11, addsDexterityModifier: true
                    },
                    OffHand: null
                }
            });

            const mageArmorEffect: ActiveEffect = {
                id: 'mage_armor',
                name: 'Mage Armor',
                type: 'set_base_ac',
                value: 13,
                duration: 28800,
                startTime: Date.now()
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
});
