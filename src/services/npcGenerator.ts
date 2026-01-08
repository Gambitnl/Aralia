import { NPC, NPCMemory, GoalStatus, Goal, TTSVoiceOption, SuspicionLevel, RichNPC, FamilyMember } from '../types/world';
import { NPCVisualSpec } from '../types/visuals';
import { RACE_NAMES } from '../data/names/raceNames';
import { RACE_PHYSICAL_TRAITS, FALLBACK_TRAITS, SCARS_AND_MARKS } from '../data/names/physicalTraits';
import { AVAILABLE_CLASSES, CLASSES_DATA } from '../data/classes';
import { BACKGROUNDS } from '../data/backgrounds';
import { AbilityScores, AbilityScoreName, PlayerCharacter, EquipmentSlotType, Item } from '../types/character';
import { getAbilityModifierValue, calculateArmorClass, calculatePassiveScore } from '../utils/character/statUtils';
import { ALL_RACES_DATA } from '../data/races';
import { ALL_ITEMS, WEAPONS_DATA, ITEMS } from '../data/items';

// Helper to simulate dice rolls string (e.g. "2d10")
function rollDiceString(diceString: string): number {
  const [count, sides] = diceString.split('d').map(Number);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Formats a height in inches to a readable string (e.g., 68" -> "5'8"").
 * @param inches Height in inches.
 * @returns Formatted height string.
 */
function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

/**
 * Selects a random element from an array.
 * @param arr The array to select from.
 * @returns A random element.
 */
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a name based on race and gender using the name data banks.
 * @param raceId The ID of the race.
 * @param gender The gender of the character.
 * @returns A generated name string.
 */
function generateName(raceId: string, gender: 'male' | 'female'): string {
    const raceData = RACE_NAMES[raceId] || RACE_NAMES.human;
    const names = gender === 'male' ? raceData.male : raceData.female;
    return getRandomElement(names);
}

/**
 * Generates a surname based on race using the name data banks.
 * @param raceId The ID of the race.
 * @returns A generated surname string.
 */
function generateSurname(raceId: string): string {
    const raceData = RACE_NAMES[raceId] || RACE_NAMES.human;
    return getRandomElement(raceData.surnames);
}

/**
 * Generates ability scores optimized for a specific class.
 * Uses the standard array (15, 14, 13, 12, 10, 8) and prioritizes stats based on class needs.
 * @param classId The ID of the class.
 * @returns An AbilityScores object.
 */
function generateAbilityScores(classId: string): AbilityScores {
    const standardArray = [15, 14, 13, 12, 10, 8];
    const priorities = CLASSES_DATA[classId]?.recommendedPointBuyPriorities || ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    
    const scores: AbilityScores = {
        Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
    };

    priorities.forEach((ability, index) => {
        if (index < standardArray.length) {
            scores[ability] = standardArray[index];
        }
    });

    return scores;
}

/**
 * Selects appropriate starting equipment based on class and level.
 * Scales gear quality with level (e.g., Chain Mail -> Plate for high-level Fighters).
 * @param classId The ID of the class.
 * @param level The character's level.
 * @returns A map of equipped items.
 */
function generateEquipment(classId: string, level: number): Partial<Record<EquipmentSlotType, Item>> {
    const equipped: Partial<Record<EquipmentSlotType, Item>> = {};
    
    // Helper to add item
    const equip = (itemId: string, slot: EquipmentSlotType) => {
        const item = ALL_ITEMS[itemId];
        if (item) equipped[slot] = item;
    };

    // Armor Logic
    // Level scaling: 1-3 Basic, 4-7 Improved, 8+ Best
    if (['fighter', 'paladin'].includes(classId)) {
        if (level >= 8) equip('plate_armor', 'Torso');
        else if (level >= 4) equip('splint_armor', 'Torso');
        else equip('chain_mail', 'Torso');
        
        equip('shield_std', 'OffHand'); // Assume sword & board for tankiness default
    } else if (['cleric'].includes(classId)) {
        if (level >= 5) equip('half_plate_armor', 'Torso');
        else equip('chain_shirt', 'Torso');
        equip('shield_std', 'OffHand');
    } else if (['ranger', 'druid'].includes(classId)) {
        if (level >= 4) equip('studded_leather_armor', 'Torso');
        else equip('leather_armor', 'Torso');
    } else if (['rogue', 'warlock'].includes(classId)) {
        equip('leather_armor', 'Torso');
    } else if (['barbarian', 'monk', 'wizard', 'sorcerer'].includes(classId)) {
        // Unarmored or robes (not armor items generally)
    }

    // Weapon Logic
    if (['fighter', 'paladin', 'barbarian'].includes(classId)) {
        if (equipped.OffHand) {
            equip('longsword', 'MainHand');
        } else {
            equip('greataxe', 'MainHand'); // Barbarian fallback or if no shield
        }
    } else if (['rogue'].includes(classId)) {
        equip('shortsword', 'MainHand');
        equip('dagger', 'OffHand');
    } else if (['ranger'].includes(classId)) {
        equip('longbow', 'MainHand'); // Two-handed, clears OffHand if set?
        // Note: Slot logic is simple here. If Two-Handed, logic should ideally clear OffHand.
        if (ALL_ITEMS['longbow'].properties?.includes('Two-Handed')) {
            delete equipped.OffHand;
        }
    } else if (['cleric', 'druid'].includes(classId)) {
        equip('mace', 'MainHand');
    } else if (['monk'].includes(classId)) {
        // Unarmed mostly, maybe Quarterstaff
        equip('quarterstaff', 'MainHand');
    } else if (['wizard', 'sorcerer', 'warlock'].includes(classId)) {
        equip('quarterstaff', 'MainHand');
    }

    return equipped;
}

/**
 * Configuration options for the NPC generator.
 */
export interface NPCGenerationConfig {
  /** Optional ID override. If not provided, a random UUID is generated. */
  id?: string;
  /** Optional name override. If not provided, a random name is chosen based on race. */
  name?: string;
  /** The system role defines functional behavior (merchant, guard, etc.). */
  role: 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';
  /** Optional specific occupation (e.g., "Blacksmith", "Baker") to refine description/personality. */
  occupation?: string;
  /** Optional race ID to influence naming and visuals. */
  raceId?: string;
  /** Optional faction affiliation. */
  faction?: string;
  /** Optional specific visual override. */
  visual?: Partial<NPCVisualSpec>;
  /** Optional voice override. */
  voice?: TTSVoiceOption;
  /** Optional starting level for memory/disposition. */
  initialDisposition?: number;
  /** Optional class ID. If not provided, one is random or inferred. */
  classId?: string;
  /** Optional level. Defaults to 1. */
  level?: number;
  /** Optional background ID. If not provided, one is random. */
  backgroundId?: string;
}

// Fallback data banks for generation if race not found
const NAMES_MALE_FALLBACK = RACE_NAMES.human.male;
const NAMES_FEMALE_FALLBACK = RACE_NAMES.human.female;
const SURNAMES_FALLBACK = RACE_NAMES.human.surnames;

const ROLE_TEMPLATES: Record<string, { baseDescription: string; personalityPrompt: string; dialogueSeed: string }> = {
  merchant: {
    baseDescription: 'checking inventory with a practiced eye.',
    personalityPrompt: 'You are friendly but focused on profit. You are always looking for a sale and are knowledgeable about the value of items.',
    dialogueSeed: 'Looking to buy? I have the finest goods in the region.',
  },
  quest_giver: {
    baseDescription: 'looking for someone capable of help.',
    personalityPrompt: 'You have a problem that needs solving and are looking for capable adventurers. You are earnest and desperate for assistance.',
    dialogueSeed: 'Excuse me, you look like you know how to handle yourself. Could I ask a favor?',
  },
  guard: {
    baseDescription: 'watching the crowd with a vigilant gaze.',
    personalityPrompt: 'You are dutiful, suspicious of trouble, and speak with authority. You value order and the law.',
    dialogueSeed: 'Move along, unless you have business here.',
  },
  civilian: {
    baseDescription: 'going about their daily business.',
    personalityPrompt: 'You are polite but wary of strangers. You care about your daily routine and local gossip.',
    dialogueSeed: 'Fine weather we are having today.',
  },
  unique: {
    baseDescription: 'standing out from the crowd.',
    personalityPrompt: 'You are cryptic and intriguing, with a secret past.',
    dialogueSeed: 'Fate has brought us together, traveler.',
  }
};

const DEFAULT_VOICES: TTSVoiceOption[] = [
  { name: 'Alloy', characteristic: 'Neutral' },
  { name: 'Echo', characteristic: 'Soft' },
  { name: 'Fable', characteristic: 'British' },
  { name: 'Onyx', characteristic: 'Deep' },
  { name: 'Nova', characteristic: 'Energetic' },
  { name: 'Shimmer', characteristic: 'High' }
];

/**
 * Generates a fully formed NPC object based on the provided configuration.
 * Orchestrates all sub-generators (names, stats, equipment, family, etc.) to produce a cohesive character.
 * @param config Configuration options for the generator.
 * @returns A RichNPC object containing all character data.
 */
export function generateNPC(config: NPCGenerationConfig): RichNPC {
  // --- 1. Identity & Race ---
  const isFemale = Math.random() > 0.5;
  const genderString = isFemale ? 'female' : 'male';
  const raceId = (config.raceId || 'human').toLowerCase();
  const raceNameData = RACE_NAMES[raceId] || RACE_NAMES.human;
  const racePhysicalData = RACE_PHYSICAL_TRAITS[raceId] || FALLBACK_TRAITS;
  const raceData = ALL_RACES_DATA[raceId] || ALL_RACES_DATA['human'];
  
  const maleNames = raceNameData.male;
  const femaleNames = raceNameData.female;
  const surnames = raceNameData.surnames;

  const firstName = config.name ? config.name.split(' ')[0] : (isFemale ? getRandomElement(femaleNames) : getRandomElement(maleNames));
  const surname = config.name && config.name.includes(' ') ? config.name.split(' ')[1] : getRandomElement(surnames);
  const finalName = config.name || `${firstName} ${surname}`;
  const id = config.id || crypto.randomUUID();

  // --- 2. Physical Description ---
  // Height and weight use dice strings to ensure variety within logical race bounds.
  const heightInches = racePhysicalData.heightBaseInches + rollDiceString(racePhysicalData.heightModifierDice);
  const heightStr = formatHeight(heightInches);
  const weightLb = racePhysicalData.weightBaseLb + (rollDiceString(racePhysicalData.heightModifierDice) * rollDiceString(racePhysicalData.weightModifierDice)); 
  
  const hairStyle = getRandomElement(racePhysicalData.hairStyles);
  const hairColor = getRandomElement(racePhysicalData.hairColors);
  const eyeColor = getRandomElement(racePhysicalData.eyeColors);
  const skinTone = getRandomElement(racePhysicalData.skinTones);
  const bodyType = getRandomElement(racePhysicalData.bodyTypes);
  
  let facialHair = '';
  if (!isFemale && racePhysicalData.facialHair) {
     const style = getRandomElement(racePhysicalData.facialHair);
     if (style !== 'None') facialHair = `, sporting a ${style.toLowerCase()}`;
  }

  // Random chance for flavor traits like scars or tattoos.
  const scarChance = 0.2;
  const distinctiveFeature = Math.random() < scarChance ? getRandomElement(SCARS_AND_MARKS) : undefined;
  
  // --- 3. Role & Personality ---
  const template = ROLE_TEMPLATES[config.role] || ROLE_TEMPLATES['civilian'];
  const occupationString = config.occupation || config.role;
  
  let physicalDesc = `A ${bodyType} ${genderString} ${raceId} ${occupationString} (${heightStr}, ${weightLb} lbs) with ${hairStyle.toLowerCase()} ${hairColor.toLowerCase()} hair and ${eyeColor.toLowerCase()} eyes${facialHair}.`;
  
  if (distinctiveFeature) {
    physicalDesc += ` ${distinctiveFeature.includes('A ') ? 'She has ' + distinctiveFeature.toLowerCase().replace('a ', '') : 'Has ' + distinctiveFeature.toLowerCase()}.`.replace('She has', isFemale ? 'She has' : 'He has').replace('Has', isFemale ? 'She has' : 'He has');
  } else {
    physicalDesc += ` ${skinTone} skin adds to their appearance.`;
  }

  const fullDescription = `${physicalDesc} ${isFemale? 'She' : 'He'} is ${template.baseDescription}`;
  const jobTitle = config.occupation || config.role;
  const personality = `You are ${finalName}, a ${jobTitle}. ${template.personalityPrompt}`;

  // --- 4. Visual Spec ---
  const visual: NPCVisualSpec = {
    description: fullDescription,
    portraitPrompt: `A fantasy portrait of ${finalName}, a ${raceId} ${occupationString}. ${physicalDesc} ${template.baseDescription}`,
    style: 'oil painting',
    themeColor: '#cccccc', 
    distinguishingFeatures: distinctiveFeature ? [distinctiveFeature] : [],
    ...config.visual
  };

  // --- 5. Biography & Mechanics ---
  // Age is clamped between the race's maturity and max age.
  const age = Math.floor(Math.random() * (racePhysicalData.ageMax - racePhysicalData.ageMaturity)) + racePhysicalData.ageMaturity;
  const charClassId = config.classId || getRandomElement(AVAILABLE_CLASSES).id;
  const backgroundId = config.backgroundId || getRandomElement(Object.keys(BACKGROUNDS));
  const level = config.level || 1;
  const abilityScores = generateAbilityScores(charClassId);
  const classData = CLASSES_DATA[charClassId];

  const equippedItems = generateEquipment(charClassId, level);

  // --- 6. Derived Stats ---
  // We use the project's standard calculation utilities to ensure NPCs follow player rules.
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
  const conMod = getAbilityModifierValue(abilityScores.Constitution);
  const dexMod = getAbilityModifierValue(abilityScores.Dexterity);
  const wisMod = getAbilityModifierValue(abilityScores.Wisdom);
  
  // HP: Base die at level 1 + averages for subsequent levels.
  const hpBase = classData.hitDie + conMod;
  const hpPerLevel = Math.floor(classData.hitDie / 2) + 1 + conMod;
  const maxHp = hpBase + (hpPerLevel * (level - 1));
  
  // Construct a mock PlayerCharacter to use existing AC logic (which handles armor/shields/unarmored).
  const mockPC = {
      race: raceData,
      class: classData,
      finalAbilityScores: abilityScores,
      equippedItems: equippedItems,
      activeEffects: [],
      proficiencyBonus,
      level
  } as unknown as PlayerCharacter;

  const armorClass = calculateArmorClass(mockPC);
  const initiativeBonus = dexMod;
  
  // Parse speed from race traits (defaults to 30).
  let speed = 30;
  const speedTrait = raceData.traits.find(t => t.toLowerCase().includes('speed:'));
  if (speedTrait) {
      const match = speedTrait.match(/(\d+)/);
      if (match) speed = parseInt(match[1], 10);
  }

  const passivePerception = calculatePassiveScore(wisMod, 0); 

  // --- 7. Family Tree Generation ---
  const family: FamilyMember[] = [];
  
  // Parents: Logic assumes parents are 20-50 years older than the NPC.
  // Mortality is calculated based on current age vs race maximum.
  const parentAgeBase = age + racePhysicalData.ageMaturity + Math.floor(Math.random() * 30);
  const parentDeadChance = parentAgeBase > racePhysicalData.ageMax ? 1 : (parentAgeBase / racePhysicalData.ageMax) * 0.8;
  
  ['Father', 'Mother'].forEach(rel => {
     const isAlive = Math.random() > parentDeadChance;
     family.push({
        id: crypto.randomUUID(),
        name: `${generateName(raceId, rel === 'Father' ? 'male' : 'female')} ${surname}`,
        relation: 'parent',
        age: parentAgeBase,
        isAlive
     });
  });

  // Spouse & Children: Only generated if the NPC is an adult.
  if (age > racePhysicalData.ageMaturity + 5 && Math.random() > 0.3) {
      const spouseAge = age + Math.floor(Math.random() * 10) - 5;
      family.push({
          id: crypto.randomUUID(),
          name: `${generateName(raceId, isFemale ? 'male' : 'female')} ${surname}`, 
          relation: 'spouse',
          age: spouseAge,
          isAlive: true
      });
      
      const fertilityStart = racePhysicalData.ageMaturity;
      const potentialChildYears = age - fertilityStart;
      if (potentialChildYears > 0) {
          const numKids = Math.floor(Math.random() * 4); 
          for (let i=0; i<numKids; i++) {
              const childAge = Math.floor(Math.random() * potentialChildYears);
              const childGender = Math.random() > 0.5 ? 'male' : 'female';
              family.push({
                  id: crypto.randomUUID(),
                  name: `${generateName(raceId, childGender)} ${surname}`,
                  relation: 'child',
                  age: childAge,
                  isAlive: true
              });

              // Grandchildren: Generated if a child is old enough to be a parent.
              if (childAge > fertilityStart) {
                   const numGrandKids = Math.floor(Math.random() * 3);
                   for(let j=0; j<numGrandKids; j++) {
                       const gcAge = Math.floor(Math.random() * (childAge - fertilityStart));
                       family.push({
                           id: crypto.randomUUID(),
                           name: `${generateName(raceId, Math.random() > 0.5 ? 'male' : 'female')} ${surname}`,
                           relation: 'grandchild',
                           age: gcAge,
                           isAlive: true
                       });
                   }
              }
          }
      }
  }

  // --- 8. Final Assembly ---
  const initialGoals: Goal[] = [];
  if (config.role === 'merchant') {
    initialGoals.push({ id: 'make_profit', description: 'Make a profit today.', status: GoalStatus.Active });
  } else if (config.role === 'guard') {
    initialGoals.push({ id: 'keep_peace', description: 'Ensure no crimes are committed on my watch.', status: GoalStatus.Active });
  }

  const voice = config.voice || DEFAULT_VOICES[Math.floor(Math.random() * DEFAULT_VOICES.length)];

  const initialMemory: NpcMemory = {
    disposition: config.initialDisposition ?? 50,
    knownFacts: [],
    suspicion: SuspicionLevel.Unaware,
    goals: [],
    lastInteractionTimestamp: 0,
    interactions: [],
  };

  return {
    id,
    name: finalName,
    baseDescription: fullDescription,
    initialPersonalityPrompt: personality,
    role: config.role,
    faction: config.faction,
    dialoguePromptSeed: template.dialogueSeed,
    voice,
    goals: initialGoals,
    visual,
    memory: initialMemory,
    biography: {
        age,
        classId: charClassId,
        backgroundId,
        level,
        family,
        abilityScores
    },
    stats: {
        hp: maxHp,
        maxHp,
        armorClass,
        speed,
        initiativeBonus,
        passivePerception,
        proficiencyBonus
    },
    equippedItems
  };
}
