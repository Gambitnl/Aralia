import { calculateArmorClass } from "../../../../utils/statUtils";
import { PlayerCharacter, Item } from "../../../../types";
import { ActiveEffect } from "../../../../types/combat";
// TODO(lint-intent): 'createMockCharacter' is unused in this test; use it in the assertion path or remove it.
import { createMockCharacter as _createMockCharacter } from "../../../../commands/__tests__/testUtils"; // Assuming this exists or I'll stub it
// TODO(lint-intent): 'createMockItem' is unused in this test; use it in the assertion path or remove it.
import { createMockItem as _createMockItem } from "../../../../data/item_templates"; // Assuming usage

// Simple mock if needed
const mockCharacterWithDex = (dexScore: number): PlayerCharacter => {
    const mod = Math.floor((dexScore - 10) / 2);
    return {
        id: "char-1",
        name: "Test Char",
        level: 1,
        abilityScores: { Strength: 10, Dexterity: dexScore, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
        finalAbilityScores: { Strength: 10, Dexterity: dexScore, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
        equippedItems: {},
        class: { id: "wizard", name: "Wizard", hitDie: 6, primaryAbility: ["Intelligence"], saves: ["Wisdom", "Intelligence"], armorProficiencies: [], weaponProficiencies: [] },
        race: { id: "human", name: "Human", speed: 30, size: "Medium", traits: [], abilityBonuses: [], languages: [] },
        hp: 10,
        maxHp: 10,
        armorClass: 10 + mod,
        speed: 30,
        xp: 0,
        skills: [],
        proficiencyBonus: 2,
        darkvisionRange: 0,
        transportMode: "foot"
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown as PlayerCharacter;
};

const mockLeatherArmor: Item = {
    id: "leather",
    name: "Leather Armor",
    type: "armor",
    rarity: "common",
    armorCategory: "Light",
    baseArmorClass: 11,
    addsDexterityModifier: true,
    description: "Leather armor",
    value: 10,
    weight: 10
};

const mockPlateArmor: Item = {
    id: "plate",
    name: "Plate Armor",
    type: "armor",
    rarity: "rare",
    armorCategory: "Heavy",
    baseArmorClass: 18,
    addsDexterityModifier: false,
    description: "Plate armor",
    value: 1500,
    weight: 65
};

const mockShield: Item = {
    id: "shield-item",
    name: "Shield",
    type: "armor",
    armorCategory: "Shield",
    armorClassBonus: 2,
    description: "A shield",
    value: 10,
    weight: 6
};

describe("AC Calculation System", () => {

    test("Base AC (Unarmored) should be 10 + Dex", () => {
        const char = mockCharacterWithDex(14); // +2 mod
        const ac = calculateArmorClass(char, []);
        expect(ac).toBe(12);
    });

    test("Armor AC should define base and cap Dex (if applicable)", () => {
        const char = mockCharacterWithDex(14); // +2 mod
        char.equippedItems.Torso = mockLeatherArmor;
        expect(calculateArmorClass(char, [])).toBe(11 + 2); // 13

        char.equippedItems.Torso = mockPlateArmor;
        expect(calculateArmorClass(char, [])).toBe(18); // 18, no dex
    });

    test("Shield should add bonus", () => {
        const char = mockCharacterWithDex(10); // +0 mod
        char.equippedItems.OffHand = mockShield;
        expect(calculateArmorClass(char, [])).toBe(10 + 2); // 12
    });

    test("Mage Armor (set_base_ac) should override Unarmored AC", () => {
        const char = mockCharacterWithDex(14); // +2 mod
        // Mage Armor: Base 13 + Dex
        const effects: ActiveEffect[] = [{
            type: "set_base_ac",
            name: "Mage Armor",
            value: 13,
            source: "mage-armor",
            duration: { type: "hours", value: 8 },
            appliedTurn: 1
        }];

        const ac = calculateArmorClass(char, effects);
        expect(ac).toBe(13 + 2); // 15
    });

    test("Mage Armor should NOT override actual Armor (based on logic in statUtils)", () => {
        const char = mockCharacterWithDex(14); // +2 mod
        char.equippedItems.Torso = mockLeatherArmor; // AC 11+2 = 13
        // If Mage Armor was erroneously applied (value 13+2 = 15)
        // Logic says IF equippedItems.Torso is armor, ignore set_base_ac effects.

        const effects: ActiveEffect[] = [{
            type: "set_base_ac",
            name: "Mage Armor",
            value: 13,
            source: "mage-armor",
            duration: { type: "hours", value: 8 },
            appliedTurn: 1
        }];

        const ac = calculateArmorClass(char, effects);
        expect(ac).toBe(13); // Leather (11) + Dex (2) = 13. Mage Armor (15) ignored.
    });

    test("Shield Spell (ac_bonus) should stack with everything", () => {
        const char = mockCharacterWithDex(14); // +2 mod
        const shieldSpell: ActiveEffect = {
            type: "ac_bonus",
            name: "Shield Spell",
            value: 5,
            source: "shield",
            duration: { type: "rounds", value: 1 },
            appliedTurn: 1
        };

        // Case 1: Unarmored
        expect(calculateArmorClass(char, [shieldSpell])).toBe(12 + 5); // 17

        // Case 2: Mage Armor + Shield Spell
        const mageArmor: ActiveEffect = {
            type: "set_base_ac",
            name: "Mage Armor",
            value: 13,
            source: "mage-armor",
            duration: { type: "hours", value: 8 },
            appliedTurn: 1
        };
        expect(calculateArmorClass(char, [mageArmor, shieldSpell])).toBe(15 + 5); // 20

        // Case 3: Plate Armor + Shield Item + Shield Spell
        char.equippedItems.Torso = mockPlateArmor;
        char.equippedItems.OffHand = mockShield;
        expect(calculateArmorClass(char, [shieldSpell])).toBe(18 + 2 + 5); // 25
    });

    test("Barkskin (ac_minimum) should floor the AC", () => {
        const char = mockCharacterWithDex(8); // -1 mod
        // Natural AC: 10 - 1 = 9

        const barkskin: ActiveEffect = {
            type: "ac_minimum",
            name: "Barkskin",
            value: 16,
            source: "barkskin",
            duration: { type: "hours", value: 1 },
            appliedTurn: 1
        };

        expect(calculateArmorClass(char, [barkskin])).toBe(16);

        // If AC is already higher, Barkskin does nothing
        const highDexChar = mockCharacterWithDex(20); // +5 mod
        // Mage Armor: 13 + 5 = 18.
        const mageArmor: ActiveEffect = {
            type: "set_base_ac",
            name: "Mage Armor",
            value: 13,
            source: "mage-armor",
            duration: { type: "hours", value: 8 },
            appliedTurn: 1
        };

        // AC 18 > 16, so should be 18
        expect(calculateArmorClass(highDexChar, [mageArmor, barkskin])).toBe(18);
    });

    test("Multiple AC Bonuses should stack (Shield + Shield of Faith)", () => {
        const char = mockCharacterWithDex(10); // 10

        const shieldSpell: ActiveEffect = {
            type: "ac_bonus",
            name: "Shield Spell",
            value: 5,
            source: "shield",
            duration: { type: "rounds", value: 1 },
            appliedTurn: 1
        };

        const sof: ActiveEffect = {
            type: "ac_bonus",
            name: "Shield of Faith",
            value: 2,
            source: "shield-of-faith",
            duration: { type: "minutes", value: 10 },
            appliedTurn: 1
        };

        expect(calculateArmorClass(char, [shieldSpell, sof])).toBe(10 + 5 + 2); // 17
    });

    test("Monk Unarmored Defense should be disabled if wearing a shield", () => {
        const char = mockCharacterWithDex(14); // +2 Dex
        char.class.id = "monk";
        char.finalAbilityScores.Wisdom = 16; // +3 Wis
        // Expected Unarmored: 10 + 2 + 3 = 15

        expect(calculateArmorClass(char, [])).toBe(15);

        // Equip Shield
        char.equippedItems.OffHand = mockShield; // +2 AC
        // Unarmored Defense lost. 
        // fallback to Natural (10 + Dex) + Shield
        // 10 + 2 + 2 = 14
        // (Note: Monk without shield was 15. With shield is 14. So shield effectively reduced AC, which is correct per rules)
        expect(calculateArmorClass(char, [])).toBe(14);
    });
});
