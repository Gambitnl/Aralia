/**
 * @file src/data/dev/dummyCharacter.ts
 * Defines the dummy character data for development and testing purposes.
 */
// TODO(lint-intent): 'Race' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { PlayerCharacter, AbilityScores, Skill, LimitedUses, SpellSlots, SpellbookData, Item, Race as _Race, Class as _CharClass } from '../../types';
import { getAbilityModifierValue, calculateArmorClass, calculateFixedRacialBonuses } from '../../utils/statUtils';
import { buildHitPointDicePools } from '../../utils/characterUtils';
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

export function getDummyInitialInventory(allItems: Record<string, Item>): Item[] {
    return [
        // Torso armor
        allItems['padded_armor'], allItems['leather_armor'], allItems['studded_leather_armor'],
        allItems['hide_armor'], allItems['chain_shirt'], allItems['scale_mail'], allItems['breastplate'], allItems['half_plate_armor'],
        allItems['ring_mail'], allItems['chain_mail'], allItems['splint_armor'], allItems['plate_armor'],
        // Shield
        allItems['shield_std'],
        allItems['shield_plus_one'],
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
        // Tools
        allItems['thieves-tools'],
    ].filter(Boolean) as Item[];
}

export const initialInventoryForDummyCharacter = getDummyInitialInventory({ ...WEAPONS_DATA, ...ITEMS });

/**
 * Lazily initializes and returns the dummy party data.
 */
export function getDummyParty(): PlayerCharacter[] {
    if (MEMOIZED_DUMMY_PARTY) {
        return MEMOIZED_DUMMY_PARTY;
    }

    // --- Use Kaelen Thorne (Data from companions.ts used as base) ---
    const kaelenRace = ALL_RACES_DATA['tiefling']; // Matching Kaelen's race
    const kaelenClass = CLASSES_DATA['rogue'];     // Matching Kaelen's class

    if (!kaelenRace || !kaelenClass) {
        return [];
    }

    const KAELEN_BASE_SCORES: AbilityScores = {
        Strength: 10, Dexterity: 16, Constitution: 14, Intelligence: 12, Wisdom: 10, Charisma: 14,
    };
    const KAELEN_FINAL_SCORES = calculateFixedRacialBonuses(KAELEN_BASE_SCORES, kaelenRace);
    const KAELEN_SKILLS: Skill[] = [SKILLS_DATA['stealth'], SKILLS_DATA['sleight_of_hand'], SKILLS_DATA['deception'], SKILLS_DATA['perception']].filter(Boolean) as Skill[];
    const KAELEN_MAX_HP = kaelenClass.hitDie + getAbilityModifierValue(KAELEN_FINAL_SCORES.Constitution);

    // Keep class-level breakdown so Hit Dice pools show the correct die.
    const kaelenClassLevels = { [kaelenClass.id]: 1 };
	    const tempKaelen: PlayerCharacter = {
	        id: 'kaelen_thorne', // MATCHING COMPANION ID
	        name: "Kaelen Thorne",
	        age: 28,
	        level: 1, proficiencyBonus: 2, xp: 0,
	        race: kaelenRace, class: kaelenClass,
          classLevels: kaelenClassLevels,
	        abilityScores: KAELEN_BASE_SCORES, finalAbilityScores: KAELEN_FINAL_SCORES,
	        skills: KAELEN_SKILLS, hp: KAELEN_MAX_HP, maxHp: KAELEN_MAX_HP,
	        // Hit Dice pools are computed after assembly to include class levels.
	        hitPointDice: undefined,
	        armorClass: 10,
	        speed: 30, darkvisionRange: 60,
	        transportMode: 'foot',
	        racialSelections: {},
	        activeEffects: [],
        statusEffects: [],
        equippedItems: {},
        limitedUses: {
            'sneak_attack': { name: 'Sneak Attack', current: 1, max: 1, resetOn: 'combat' } // visual placeholder usage
        },
    };
    tempKaelen.hitPointDice = buildHitPointDicePools(tempKaelen, { classLevels: kaelenClassLevels });
    tempKaelen.armorClass = calculateArmorClass(tempKaelen);

    // --- Use Elara Vance (Data from companions.ts used as base) ---
    const elaraRace = ALL_RACES_DATA['human'];
    const elaraClass = CLASSES_DATA['cleric'];

    if (!elaraRace || !elaraClass) {
        MEMOIZED_DUMMY_PARTY = [tempKaelen];
        return MEMOIZED_DUMMY_PARTY;
    }

    const ELARA_BASE_SCORES: AbilityScores = {
        Strength: 12, Dexterity: 10, Constitution: 14, Intelligence: 10, Wisdom: 16, Charisma: 13
    };
    const ELARA_FINAL_SCORES = calculateFixedRacialBonuses(ELARA_BASE_SCORES, elaraRace);
    const ELARA_MAX_HP = elaraClass.hitDie + getAbilityModifierValue(ELARA_FINAL_SCORES.Constitution);
    const ELARA_SKILLS: Skill[] = [SKILLS_DATA['medicine'], SKILLS_DATA['religion'], SKILLS_DATA['insight']].filter(Boolean) as Skill[];

    // Simple cleric setup
    const elaraSpellbook: SpellbookData = {
        cantrips: ['sacred-flame', 'light', 'guidance'],
        knownSpells: [],
        preparedSpells: ['cure-wounds', 'bless']
    };
    const elaraSlots: SpellSlots = {
        level_1: { current: 2, max: 2 }, level_2: { current: 0, max: 0 }, level_3: { current: 0, max: 0 },
        level_4: { current: 0, max: 0 }, level_5: { current: 0, max: 0 }, level_6: { current: 0, max: 0 },
        level_7: { current: 0, max: 0 }, level_8: { current: 0, max: 0 }, level_9: { current: 0, max: 0 },
    };

    // Keep class-level breakdown so Hit Dice pools show the correct die.
    const elaraClassLevels = { [elaraClass.id]: 1 };
	    const tempElara: PlayerCharacter = {
	        id: 'elara_vance', // MATCHING COMPANION ID
	        name: "Elara Vance",
	        age: 24,
	        level: 1, proficiencyBonus: 2, xp: 0,
	        race: elaraRace, class: elaraClass,
          classLevels: elaraClassLevels,
	        abilityScores: ELARA_BASE_SCORES, finalAbilityScores: ELARA_FINAL_SCORES,
	        skills: ELARA_SKILLS, hp: ELARA_MAX_HP, maxHp: ELARA_MAX_HP,
	        // Hit Dice pools are computed after assembly to include class levels.
	        hitPointDice: undefined,
	        armorClass: 10,
	        speed: 30,
	        darkvisionRange: 0,
	        transportMode: 'foot',
	        racialSelections: { human: { skillIds: ['medicine'] } },
        selectedDivineOrder: 'Protector',
        spellcastingAbility: 'wisdom', spellbook: elaraSpellbook, spellSlots: elaraSlots,
        limitedUses: {}, equippedItems: {},
        activeEffects: [], statusEffects: [],
    };
    tempElara.hitPointDice = buildHitPointDicePools(tempElara, { classLevels: elaraClassLevels });
    tempElara.armorClass = calculateArmorClass(tempElara);

    // --- Create DEv Player ---
    const playerRace = ALL_RACES_DATA['human'];
    const playerClass = CLASSES_DATA['fighter'];

    const PLAYER_BASE_SCORES: AbilityScores = {
        Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10,
    };
    const PLAYER_FINAL_SCORES = calculateFixedRacialBonuses(PLAYER_BASE_SCORES, playerRace);
    const PLAYER_SKILLS: Skill[] = [SKILLS_DATA['athletics'], SKILLS_DATA['survival']].filter(Boolean) as Skill[];
    const PLAYER_MAX_HP = playerClass.hitDie + getAbilityModifierValue(PLAYER_FINAL_SCORES.Constitution);

    // Keep class-level breakdown so Hit Dice pools show the correct die.
    const playerClassLevels = { [playerClass.id]: 1 };
	    const tempPlayer: PlayerCharacter = {
	        id: 'player', // STANDARD PLAYER ID
	        name: "Dev Player",
	        age: 30,
	        level: 1, proficiencyBonus: 2, xp: 0,
	        race: playerRace, class: playerClass,
          classLevels: playerClassLevels,
	        abilityScores: PLAYER_BASE_SCORES, finalAbilityScores: PLAYER_FINAL_SCORES,
	        skills: PLAYER_SKILLS, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
	        // Hit Dice pools are computed after assembly to include class levels.
	        hitPointDice: undefined,
	        armorClass: 10,
	        speed: 30, darkvisionRange: 0,
	        transportMode: 'foot',
	        racialSelections: { human: { skillIds: ['survival'] } },
	        activeEffects: [], statusEffects: [],
        equippedItems: {
            OffHand: ITEMS['shield_std'], // Equip regular shield for testing upgrade indicators
        },
        limitedUses: {
            'second_wind': { name: 'Second Wind', current: 1, max: 1, resetOn: 'short_rest' }
        },
    };
    tempPlayer.hitPointDice = buildHitPointDicePools(tempPlayer, { classLevels: playerClassLevels });
    tempPlayer.armorClass = calculateArmorClass(tempPlayer);

    MEMOIZED_DUMMY_PARTY = [tempPlayer, tempKaelen, tempElara];
    return MEMOIZED_DUMMY_PARTY;
}

export const USE_DUMMY_CHARACTER_FOR_DEV = FEATURES.ENABLE_DEV_TOOLS;
