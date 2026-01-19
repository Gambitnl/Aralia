
/**
 * @file src/services/characterGenerator.ts
 * Service for generating full PlayerCharacter objects from simplified configurations.
 * This allows the AI (or other systems) to create valid characters without going through
 * the UI wizard, while ensuring all derived stats (HP, AC, Speed, etc.) are calculated correctly.
 */
import { PlayerCharacter, AbilityScores, SpellbookData, SpellSlots, LimitedUses, Item, Skill, EquipmentSlotType } from '../types';
import { RACES_DATA as ALL_RACES_DATA, CLASSES_DATA, WEAPONS_DATA, ITEMS } from '../constants';
import { SKILLS_DATA } from '../data/skills';
import { getAbilityModifierValue, calculateArmorClass, buildHitPointDicePools } from '../utils/characterUtils';

export interface CharacterGenerationConfig {
  name: string;
  raceId: string;
  classId: string;
  backgroundBio?: string;
  // Optional: If not provided, standard array or class recommendations will be used
  abilityScores?: AbilityScores; 
  // Optional: AI can suggest specific skills, otherwise class defaults picked
  skillIds?: string[]; 
}

/**
 * Generates a complete PlayerCharacter object from a partial configuration.
 * Automatically handles derived stats, equipment (Option A defaults), and resource setup.
 */
export function generateCharacterFromConfig(config: CharacterGenerationConfig): PlayerCharacter | null {
    const race = ALL_RACES_DATA[config.raceId];
    const charClass = CLASSES_DATA[config.classId];

    if (!race || !charClass) {
        console.error(`Character Generation Failed: Invalid Race (${config.raceId}) or Class (${config.classId})`);
        return null;
    }

    // 1. Handle Ability Scores
    // Default to Standard Array if not provided: 15, 14, 13, 12, 10, 8
    // We assign them based on class recommendations if available, otherwise generic order.
    let baseScores: AbilityScores;
    
    if (config.abilityScores) {
        baseScores = config.abilityScores;
    } else {
        const priorities = charClass.recommendedPointBuyPriorities || ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        const standardArray = [15, 14, 13, 12, 10, 8];
        baseScores = {
            Strength: 8, Dexterity: 8, Constitution: 8, Intelligence: 8, Wisdom: 8, Charisma: 8
        };
        // Assign standard array based on priority
        priorities.forEach((ability, index) => {
            if (index < standardArray.length) {
                baseScores[ability] = standardArray[index];
            }
        });
    }

    // Apply Racial Bonuses (if fixed) - Note: Most 2024 races in this app use flexible/point-buy
    // For this generator, we assume the baseScores provided by AI *include* any flexible bonuses 
    // or we accept the raw scores.
    const finalAbilityScores = { ...baseScores }; 
    if (race.abilityBonuses) {
        race.abilityBonuses.forEach(bonus => {
            if (bonus.ability === 'Any') {
                return;
            }
            finalAbilityScores[bonus.ability] += bonus.bonus;
        });
    }

    // 2. Handle Skills
    const selectedSkills: Skill[] = [];
    // Basic logic: Pick the first N skills from the class list if not specified
    const numSkills = charClass.numberOfSkillProficiencies;
    const available = charClass.skillProficienciesAvailable;
    
    if (config.skillIds) {
        // Validate and map AI suggestions
        config.skillIds.forEach(id => {
            if (SKILLS_DATA[id]) selectedSkills.push(SKILLS_DATA[id]);
        });
    }
    
    // Fill remaining slots with defaults if AI didn't provide enough valid ones
    if (selectedSkills.length < numSkills) {
        for (const skillId of available) {
            if (selectedSkills.length >= numSkills) break;
            if (!selectedSkills.some(s => s.id === skillId) && SKILLS_DATA[skillId]) {
                selectedSkills.push(SKILLS_DATA[skillId]);
            }
        }
    }

    // 3. Derived Stats
    const level = 1;
    const proficiencyBonus = 2;
    const conMod = getAbilityModifierValue(finalAbilityScores.Constitution);
    let maxHp = charClass.hitDie + conMod;
    if (race.id === 'dwarf') maxHp += 1; // Dwarven Toughness

    // Speed
    let speed = 30;
    const speedTrait = race.traits.find(t => t.toLowerCase().startsWith('speed:'));
    if (speedTrait) {
        const match = speedTrait.match(/(\d+)/);
        if (match) speed = parseInt(match[1], 10);
    }
    
    // Darkvision
    let darkvisionRange = 0;
    const dvTrait = race.traits.find(t => t.toLowerCase().includes('darkvision'));
    if (dvTrait) {
        const match = dvTrait.match(/(\d+)/);
        if (match) darkvisionRange = parseInt(match[1], 10);
    }
    if (race.id === 'drow' || race.id === 'deep_gnome') darkvisionRange = 120;


    // 4. Equipment (Simplified: Class "A" or default approximations)
    // In a real app, we'd parse `charClass.startingEquipment`. Here we map manually for key classes or generic fallbacks.
    const equippedItems: Partial<Record<EquipmentSlotType, Item>> = {};
    const inventory: Item[] = [];
    
    // Generic gear allocation
    const addIfExists = (id: string, slot?: EquipmentSlotType) => {
        const item = WEAPONS_DATA[id] || ITEMS[id];
        if (item) {
            if (slot) equippedItems[slot] = item;
            else inventory.push(item);
        }
    };

    if (charClass.id === 'fighter' || charClass.id === 'paladin') {
        addIfExists('chain_mail', 'Torso');
        addIfExists('longsword', 'MainHand');
        addIfExists('shield_std', 'OffHand');
    } else if (charClass.id === 'rogue' || charClass.id === 'ranger') {
        addIfExists('leather_armor', 'Torso');
        addIfExists('shortsword', 'MainHand');
        addIfExists('shortbow', 'OffHand'); // Abstracted slot usage
    } else if (charClass.id === 'wizard' || charClass.id === 'sorcerer' || charClass.id === 'warlock') {
        addIfExists('quarterstaff', 'MainHand');
        // No armor usually
    } else if (charClass.id === 'cleric') {
        addIfExists('chain_shirt', 'Torso');
        addIfExists('mace', 'MainHand');
        addIfExists('shield_std', 'OffHand');
    } else if (charClass.id === 'druid') {
        addIfExists('leather_armor', 'Torso');
        addIfExists('quarterstaff', 'MainHand');
    } else if (charClass.id === 'barbarian') {
        addIfExists('greataxe', 'MainHand');
    } else {
        // Fallback
        addIfExists('dagger', 'MainHand');
        addIfExists('leather_armor', 'Torso');
    }
    
    addIfExists('healing_potion'); // Everyone gets a potion
    
    // 5. Spellcasting Setup
    let spellbook: SpellbookData | undefined;
    let spellSlots: SpellSlots | undefined;
    let spellcastingAbility: 'intelligence' | 'wisdom' | 'charisma' | undefined;

    if (charClass.spellcasting) {
        const ability = charClass.spellcasting.ability.toLowerCase();
        if (ability === 'intelligence' || ability === 'wisdom' || ability === 'charisma') {
            spellcastingAbility = ability;
        }
        
        // Assign default spells from the class list
        const cantrips = charClass.spellcasting.spellList
            .filter(_id => {
                // In a real scenario we'd check level=0, for now relying on ID naming or external check
                // Simplified: just take first N
                return true; 
            })
            .slice(0, charClass.spellcasting.knownCantrips);
            
        const level1Spells = charClass.spellcasting.spellList
            .filter(id => !cantrips.includes(id))
            .slice(0, charClass.spellcasting.knownSpellsL1);

        spellbook = {
            cantrips: cantrips,
            preparedSpells: level1Spells,
            knownSpells: [...cantrips, ...level1Spells]
        };

        spellSlots = {
            level_1: { current: 2, max: 2 }, // Standard level 1 caster
            level_2: { current: 0, max: 0 }, level_3: { current: 0, max: 0 },
            level_4: { current: 0, max: 0 }, level_5: { current: 0, max: 0 },
            level_6: { current: 0, max: 0 }, level_7: { current: 0, max: 0 },
            level_8: { current: 0, max: 0 }, level_9: { current: 0, max: 0 },
        };
        if (charClass.id === 'warlock') spellSlots.level_1 = { current: 1, max: 1 };
    }

    const limitedUses: LimitedUses = {};
    if (charClass.id === 'fighter') {
      limitedUses['second_wind'] = { name: 'Second Wind', current: 1, max: 1, resetOn: 'short_rest' };
    }
    if (charClass.id === 'barbarian') {
      limitedUses['rage'] = { name: 'Rage', current: 2, max: 2, resetOn: 'long_rest' };
    }
    if (charClass.id === 'bard') {
      const chaMod = getAbilityModifierValue(finalAbilityScores.Charisma);
      const bardicDice = Math.max(1, chaMod);
      limitedUses['bardic_inspiration'] = { name: 'Bardic Inspiration', current: bardicDice, max: bardicDice, resetOn: 'long_rest' };
    }
    if (charClass.id === 'paladin') {
       limitedUses['lay_on_hands'] = { name: 'Lay on Hands', current: 5, max: 5, resetOn: 'long_rest' };
    }

    // 6. Final Assembly
    // Track class levels so Hit Dice pools reflect the correct die size.
    const classLevels = { [charClass.id]: level };
    const character: PlayerCharacter = {
        id: crypto.randomUUID(),
        name: config.name,
        level,
        proficiencyBonus,
        race,
        class: charClass,
        classLevels,
        abilityScores: baseScores,
        finalAbilityScores,
	        skills: selectedSkills,
	        hp: maxHp,
	        maxHp,
	        // Build Hit Dice after assembly to preserve pool formatting.
	        hitPointDice: undefined,
	        armorClass: 10, // Recalculated below
	        speed,
	        darkvisionRange,
	        transportMode: 'foot',
        statusEffects: [],
        equippedItems,
        spellbook,
        spellSlots,
        spellcastingAbility,
        limitedUses,
        racialSelections: {}, // Default empty for generated chars
        // Add default sub-selections if needed for strict typing, or leave optional
    };

    character.hitPointDice = buildHitPointDicePools(character, { classLevels });
    character.armorClass = calculateArmorClass(character);

    return character;
}
