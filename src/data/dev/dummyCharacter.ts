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

let DUMMY_PARTY_FOR_DEV: PlayerCharacter[] = [];

export function getDummyInitialInventory(allItems: Record<string, Item>): Item[] {
    return [
        // Torso armor
        allItems['padded_armor'], allItems['leather_armor'], allItems['studded_leather_armor'],
        allItems['hide_armor'], allItems['chain_shirt'], allItems['scale_mail'], allItems['breastplate'], allItems['half_plate_armor'],
        allItems['ring_mail'], allItems['chain_mail'], allItems['splint_armor'], allItems['plate_armor'],
        // Shield
        allItems['shield_std'],
        // === ALL WEAPONS WITH MASTERIES ===
        // Simple Melee Weapons (10 weapons)
        allItems['club'],           // Mastery: Slow
        allItems['dagger'],         // Mastery: Nick
        allItems['greatclub'],      // Mastery: Push
        allItems['handaxe'],        // Mastery: Vex
        allItems['javelin'],        // Mastery: Slow
        allItems['light_hammer'],   // Mastery: Nick
        allItems['mace'],           // Mastery: Sap
        allItems['quarterstaff'],   // Mastery: Topple
        allItems['sickle'],         // Mastery: Nick
        allItems['spear'],          // Mastery: Sap
        // Simple Ranged Weapons (4 weapons)
        allItems['dart'],           // Mastery: Vex
        allItems['light_crossbow'], // Mastery: Slow
        allItems['shortbow'],       // Mastery: Vex
        allItems['sling'],          // Mastery: Slow
        // Martial Melee Weapons (18 weapons)
        allItems['battleaxe'],      // Mastery: Topple
        allItems['flail'],          // Mastery: Sap
        allItems['glaive'],         // Mastery: Graze
        allItems['greataxe'],       // Mastery: Cleave
        allItems['greatsword'],     // Mastery: Graze
        allItems['halberd'],        // Mastery: Cleave
        allItems['lance'],          // Mastery: Topple
        allItems['longsword'],      // Mastery: Sap
        allItems['maul'],           // Mastery: Topple
        allItems['morningstar'],    // Mastery: Sap
        allItems['pike'],           // Mastery: Push
        allItems['rapier'],         // Mastery: Vex
        allItems['scimitar'],       // Mastery: Nick
        allItems['shortsword'],     // Mastery: Vex
        allItems['trident'],        // Mastery: Topple
        allItems['warhammer'],      // Mastery: Push
        allItems['war_pick'],       // Mastery: Sap
        allItems['whip'],           // Mastery: Slow
        // Martial Ranged Weapons (4 weapons)
        allItems['blowgun'],        // Mastery: Vex
        allItems['longbow'],        // Mastery: Slow
        allItems['hand_crossbow'],  // Mastery: Vex
        allItems['heavy_crossbow'], // Mastery: Push
        // Legacy weapon
        allItems['rusty_sword'],    // Mastery: Nick
        // Head armor
        allItems['leather_cap'], allItems['chainmail_coif'], allItems['steel_helmet'],
        // Hands armor
        allItems['leather_gloves'], allItems['chainmail_gauntlets'], allItems['plate_gauntlets'],
        // Legs armor
        allItems['cloth_pants'], allItems['leather_greaves'], allItems['plate_greaves'],
        // Feet armor
        allItems['soft_boots'], allItems['studded_boots'], allItems['steel_boots'],
        // Wrists armor
        allItems['leather_bracers'], allItems['reinforced_bracers'],
        // Accessories
        allItems['silver_necklace'], allItems['amulet_of_health'],
        allItems['travelers_cloak'], allItems['cloak_of_protection'],
        allItems['leather_belt'], allItems['belt_of_giant_strength'],
        allItems['silver_ring'], allItems['gold_ring'], allItems['ring_of_protection'],
        // Consumables
        allItems['healing_potion'],
    ].filter(Boolean) as Item[];
}

export const initialInventoryForDummyCharacter = getDummyInitialInventory({ ...WEAPONS_DATA, ...ITEMS });

/**
 * Initializes dummy characters using the provided data.
 * This function is pure(ish) - it returns a new array of characters based on inputs.
 */
export function initializeDummyCharacterData(
    allRaces: Record<string, Race>,
    allClasses: Record<string, CharClass>,
    allSkills: Record<string, Skill>
): PlayerCharacter[] {
    // --- Create Fighter ---
    const dummyFighterRace = allRaces[DUMMY_FIGHTER_RACE_ID];
    const dummyFighterClass = allClasses[DUMMY_FIGHTER_CLASS_ID];

    if (!dummyFighterRace || !dummyFighterClass) {
        // console.error("Failed to initialize dummy fighter: Race or Class data missing.")
        return [];
    }

    const DUMMY_FIGHTER_BASE_SCORES: AbilityScores = {
        Strength: 15, Dexterity: 13, Constitution: 14, Intelligence: 8, Wisdom: 12, Charisma: 10,
    };
    const DUMMY_FIGHTER_FINAL_SCORES = calculateFixedRacialBonuses(DUMMY_FIGHTER_BASE_SCORES, dummyFighterRace);
    const DUMMY_FIGHTER_SKILLS: Skill[] = [allSkills['athletics'], allSkills['intimidation'], allSkills['perception']].filter(Boolean) as Skill[];
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
        armorClass: 10, speed: 30, darkvisionRange: 0,
        transportMode: 'foot',
        racialSelections: {
            human: { skillIds: ['perception'] } // Human's "Skillful" trait selection
        },
        selectedFightingStyle: DUMMY_FIGHTER_FIGHTING_STYLE,
        equippedItems: {}, limitedUses: DUMMY_FIGHTER_LIMITED_USES,
    };
    tempFighter.armorClass = calculateArmorClass(tempFighter);

    // --- Create Cleric ---
    const dummyClericRace = allRaces[DUMMY_CLERIC_RACE_ID];
    const dummyClericClass = allClasses[DUMMY_CLERIC_CLASS_ID];

    if (!dummyClericRace || !dummyClericClass) {
        // console.error("Failed to initialize dummy cleric: Race or Class data missing.")
        return [tempFighter]; // Return at least the fighter
    }

    const DUMMY_CLERIC_BASE_SCORES: AbilityScores = {
        Strength: 14, Dexterity: 10, Constitution: 16, Intelligence: 8, Wisdom: 15, Charisma: 12
    };
    const DUMMY_CLERIC_FINAL_SCORES = calculateFixedRacialBonuses(DUMMY_CLERIC_BASE_SCORES, dummyClericRace);
    const DUMMY_CLERIC_MAX_HP = dummyClericClass.hitDie + getAbilityModifierValue(DUMMY_CLERIC_FINAL_SCORES.Constitution) + 1; // +1 for Dwarven Toughness
    const DUMMY_CLERIC_SKILLS: Skill[] = [allSkills['medicine'], allSkills['religion']].filter(Boolean) as Skill[];
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

    return [tempFighter, tempCleric];
}

// Internal function to populate the global DUMMY_PARTY_FOR_DEV using imports
// This keeps the side effect contained here, but allows the exported function
// to remain pure and testable with mocks.
function initializeInternal() {
    const initializedDummyParty = initializeDummyCharacterData(ALL_RACES_DATA, CLASSES_DATA, SKILLS_DATA);
    DUMMY_PARTY_FOR_DEV.push(...initializedDummyParty);
}

// Perform initialization immediately
initializeInternal();


export const USE_DUMMY_CHARACTER_FOR_DEV = FEATURES.ENABLE_DEV_TOOLS;

export { DUMMY_PARTY_FOR_DEV };

export function setInitializedDummyCharacter(party: PlayerCharacter[]) {
    DUMMY_PARTY_FOR_DEV.length = 0; // Clear existing array
    DUMMY_PARTY_FOR_DEV.push(...party); // Push new characters
}
