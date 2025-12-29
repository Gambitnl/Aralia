/**
 * @file src/data/dev/dummyCharacter.ts
 * Defines the dummy character data for development and testing purposes.
 */
import { PlayerCharacter, AbilityScores, Skill, LimitedUses, SpellSlots, SpellbookData, Item, Race, Class as CharClass } from '../../types';
import { getAbilityModifierValue, calculateArmorClass, calculateFixedRacialBonuses } from '../../utils/statUtils';
import { FEATURES } from '../../config/features';

import { ALL_RACES_DATA } from '../races/index.ts';
import { CLASSES_DATA } from '../classes';
import { SKILLS_DATA } from '../skills';
import { ITEMS, WEAPONS_DATA } from '../items';

// --- DUMMY CHARACTER FOR DEVELOPMENT ---

const DUMMY_FIGHTER_RACE_ID = 'human';
const DUMMY_FIGHTER_CLASS_ID = 'fighter';

const DUMMY_CLERIC_RACE_ID = 'dwarf';
const DUMMY_CLERIC_CLASS_ID = 'cleric';

let MEMOIZED_DUMMY_PARTY: PlayerCharacter[] | null = null;
let MEMOIZED_DUMMY_INVENTORY: Item[] | null = null;

export function getDummyInitialInventory(allItems?: Record<string, Item>): Item[] {
    // If custom items are provided, do not use the cache as the inputs differ.
    // Also do not populate the global cache with custom results.
    if (allItems) {
        return createDummyInventory(allItems);
    }

    if (MEMOIZED_DUMMY_INVENTORY) {
        return MEMOIZED_DUMMY_INVENTORY;
    }

    // Default case: use global data and cache it
    const items = { ...WEAPONS_DATA, ...ITEMS };
    MEMOIZED_DUMMY_INVENTORY = createDummyInventory(items);

    return MEMOIZED_DUMMY_INVENTORY;
}

// Helper to contain the filter logic
function createDummyInventory(items: Record<string, Item>): Item[] {
    return [
        // Torso armor
        items['padded_armor'], items['leather_armor'], items['studded_leather_armor'],
        items['hide_armor'], items['chain_shirt'], items['scale_mail'], items['breastplate'], items['half_plate_armor'],
        items['ring_mail'], items['chain_mail'], items['splint_armor'], items['plate_armor'],
        // Shield
        items['shield_std'],
        // === ALL WEAPONS WITH MASTERIES ===
        // Simple Melee Weapons (10 weapons)
        items['club'],           // Mastery: Slow
        items['dagger'],         // Mastery: Nick
        items['greatclub'],      // Mastery: Push
        items['handaxe'],        // Mastery: Vex
        items['javelin'],        // Mastery: Slow
        items['light_hammer'],   // Mastery: Nick
        items['mace'],           // Mastery: Sap
        items['quarterstaff'],   // Mastery: Topple
        items['sickle'],         // Mastery: Nick
        items['spear'],          // Mastery: Sap
        // Simple Ranged Weapons (4 weapons)
        items['dart'],           // Mastery: Vex
        items['light_crossbow'], // Mastery: Slow
        items['shortbow'],       // Mastery: Vex
        items['sling'],          // Mastery: Slow
        // Martial Melee Weapons (18 weapons)
        items['battleaxe'],      // Mastery: Topple
        items['flail'],          // Mastery: Sap
        items['glaive'],         // Mastery: Graze
        items['greataxe'],       // Mastery: Cleave
        items['greatsword'],     // Mastery: Graze
        items['halberd'],        // Mastery: Cleave
        items['lance'],          // Mastery: Topple
        items['longsword'],      // Mastery: Sap
        items['maul'],           // Mastery: Topple
        items['morningstar'],    // Mastery: Sap
        items['pike'],           // Mastery: Push
        items['rapier'],         // Mastery: Vex
        items['scimitar'],       // Mastery: Nick
        items['shortsword'],     // Mastery: Vex
        items['trident'],        // Mastery: Topple
        items['warhammer'],      // Mastery: Push
        items['war_pick'],       // Mastery: Sap
        items['whip'],           // Mastery: Slow
        // Martial Ranged Weapons (4 weapons)
        items['blowgun'],        // Mastery: Vex
        items['longbow'],        // Mastery: Slow
        items['hand_crossbow'],  // Mastery: Vex
        items['heavy_crossbow'], // Mastery: Push
        // Legacy weapon
        items['rusty_sword'],    // Mastery: Nick
        // Head armor
        items['leather_cap'], items['chainmail_coif'], items['steel_helmet'],
        // Hands armor
        items['leather_gloves'], items['chainmail_gauntlets'], items['plate_gauntlets'],
        // Legs armor
        items['cloth_pants'], items['leather_greaves'], items['plate_greaves'],
        // Feet armor
        items['soft_boots'], items['studded_boots'], items['steel_boots'],
        // Wrists armor
        items['leather_bracers'], items['reinforced_bracers'],
        // Accessories
        items['silver_necklace'], items['amulet_of_health'],
        items['travelers_cloak'], items['cloak_of_protection'],
        items['leather_belt'], items['belt_of_giant_strength'],
        items['silver_ring'], items['gold_ring'], items['ring_of_protection'],
        // Consumables
        items['healing_potion'],
    ].filter(Boolean) as Item[];
}

/**
 * Lazily initializes and returns the dummy party data.
 */
export function getDummyParty(): PlayerCharacter[] {
    if (MEMOIZED_DUMMY_PARTY) {
        return MEMOIZED_DUMMY_PARTY;
    }

    // --- Create Fighter ---
    const dummyFighterRace = ALL_RACES_DATA[DUMMY_FIGHTER_RACE_ID];
    const dummyFighterClass = CLASSES_DATA[DUMMY_FIGHTER_CLASS_ID];

    if (!dummyFighterRace || !dummyFighterClass) {
        return [];
    }

    const DUMMY_FIGHTER_BASE_SCORES: AbilityScores = {
        Strength: 15, Dexterity: 13, Constitution: 14, Intelligence: 8, Wisdom: 12, Charisma: 10,
    };
    const DUMMY_FIGHTER_FINAL_SCORES = calculateFixedRacialBonuses(DUMMY_FIGHTER_BASE_SCORES, dummyFighterRace);
    const DUMMY_FIGHTER_SKILLS: Skill[] = [SKILLS_DATA['athletics'], SKILLS_DATA['intimidation'], SKILLS_DATA['perception']].filter(Boolean) as Skill[];
    const DUMMY_FIGHTER_FIGHTING_STYLE = dummyFighterClass.fightingStyles?.find((style) => style.id === 'defense');
    const DUMMY_FIGHTER_MAX_HP = dummyFighterClass.hitDie + getAbilityModifierValue(DUMMY_FIGHTER_FINAL_SCORES.Constitution);
    const DUMMY_FIGHTER_LIMITED_USES: LimitedUses = {
        'second_wind': { name: 'Second Wind', current: 1, max: 1, resetOn: 'short_rest' }
    };

    const tempFighter: PlayerCharacter = {
        id: 'dev_dummy_fighter',
        name: "Dev Fighter",
        age: 25,
        level: 1, proficiencyBonus: 2, xp: 0,
        race: dummyFighterRace, class: dummyFighterClass,
        abilityScores: DUMMY_FIGHTER_BASE_SCORES, finalAbilityScores: DUMMY_FIGHTER_FINAL_SCORES,
        skills: DUMMY_FIGHTER_SKILLS, hp: DUMMY_FIGHTER_MAX_HP, maxHp: DUMMY_FIGHTER_MAX_HP,
        armorClass: 10,
        speed: 30, darkvisionRange: 0,
        transportMode: 'foot',
        racialSelections: {
            human: { skillIds: ['perception'] } // Human's "Skillful" trait selection
        },
        selectedFightingStyle: DUMMY_FIGHTER_FIGHTING_STYLE,
        equippedItems: {}, limitedUses: DUMMY_FIGHTER_LIMITED_USES,
    };
    tempFighter.armorClass = calculateArmorClass(tempFighter);

    // --- Create Cleric ---
    const dummyClericRace = ALL_RACES_DATA[DUMMY_CLERIC_RACE_ID];
    const dummyClericClass = CLASSES_DATA[DUMMY_CLERIC_CLASS_ID];

    if (!dummyClericRace || !dummyClericClass) {
        MEMOIZED_DUMMY_PARTY = [tempFighter];
        return MEMOIZED_DUMMY_PARTY;
    }

    const DUMMY_CLERIC_BASE_SCORES: AbilityScores = {
        Strength: 14, Dexterity: 10, Constitution: 16, Intelligence: 8, Wisdom: 15, Charisma: 12
    };
    const DUMMY_CLERIC_FINAL_SCORES = calculateFixedRacialBonuses(DUMMY_CLERIC_BASE_SCORES, dummyClericRace);
    const DUMMY_CLERIC_MAX_HP = dummyClericClass.hitDie + getAbilityModifierValue(DUMMY_CLERIC_FINAL_SCORES.Constitution) + 1; // +1 for Dwarven Toughness
    const DUMMY_CLERIC_SKILLS: Skill[] = [SKILLS_DATA['medicine'], SKILLS_DATA['religion']].filter(Boolean) as Skill[];
    const clericSpellList = dummyClericClass.spellcasting?.spellList || [];
    const DUMMY_CLERIC_SPELLBOOK: SpellbookData = {
        cantrips: ['sacred-flame', 'light', 'guidance', 'thaumaturgy'], // Using kebab-case
        knownSpells: clericSpellList,
        preparedSpells: ['cure-wounds', 'bless'] // Using kebab-case
    };
    const DUMMY_CLERIC_SPELL_SLOTS: SpellSlots = {
        level_1: { current: 2, max: 2 }, level_2: { current: 0, max: 0 }, level_3: { current: 0, max: 0 },
        level_4: { current: 0, max: 0 }, level_5: { current: 0, max: 0 }, level_6: { current: 0, max: 0 },
        level_7: { current: 0, max: 0 }, level_8: { current: 0, max: 0 }, level_9: { current: 0, max: 0 },
    };

    const tempCleric: PlayerCharacter = {
        id: 'dev_dummy_cleric',
        name: "Dev Cleric",
        age: 55,
        level: 1, proficiencyBonus: 2, xp: 0,
        race: dummyClericRace, class: dummyClericClass,
        abilityScores: DUMMY_CLERIC_BASE_SCORES, finalAbilityScores: DUMMY_CLERIC_FINAL_SCORES,
        skills: DUMMY_CLERIC_SKILLS, hp: DUMMY_CLERIC_MAX_HP, maxHp: DUMMY_CLERIC_MAX_HP,
        armorClass: 10, // Placeholder
        speed: 30, // My dwarf data has 30ft speed
        darkvisionRange: 120,
        transportMode: 'foot',
        racialSelections: {}, // Dwarf has no level 1 choices
        selectedDivineOrder: 'Thaumaturge', // Changed from Protector
        spellcastingAbility: 'wisdom', spellbook: DUMMY_CLERIC_SPELLBOOK, spellSlots: DUMMY_CLERIC_SPELL_SLOTS,
        limitedUses: {}, equippedItems: {},
        selectedFightingStyle: undefined, // ensure fighter-specific fields are undefined
    };
    tempCleric.armorClass = calculateArmorClass(tempCleric);

    MEMOIZED_DUMMY_PARTY = [tempFighter, tempCleric];
    return MEMOIZED_DUMMY_PARTY;
}

export const USE_DUMMY_CHARACTER_FOR_DEV = FEATURES.ENABLE_DEV_TOOLS;
