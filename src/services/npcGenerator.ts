// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 10:30:03
 * Dependents: components/World3D/World3DWrapper.tsx, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleNpcInteraction.ts, services/CompanionGenerator.ts, systems/gameEntry/situationNpcToRichNpc.ts, systems/party/authoredCompanionToRichNpc.ts, systems/party/npcToPartyMember.ts, systems/worldforge/townsim/registerBurgMerchants.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GoalStatus, Goal, SuspicionLevel, RichNPC, FamilyMember, NpcMemory, TTSVoiceOption } from '../types/world.js';
import { NPCVisualSpec } from '../types/visuals.js';
import { RACE_NAMES } from '../data/names/raceNames.js';
import { RACE_PHYSICAL_TRAITS, FALLBACK_TRAITS, SCARS_AND_MARKS } from '../data/names/physicalTraits.js';
import { AVAILABLE_CLASSES, CLASSES_DATA } from '../data/classes/index.js';
import { BACKGROUNDS } from '../data/backgrounds.js';
import { AbilityScores, PlayerCharacter } from '../types/character.js';
import type { EquipmentSlotType, Item } from '../types/items.js';
import { getAbilityModifierValue, calculateArmorClass, calculatePassiveScore } from '../utils/character/statUtils.js';
import { ALL_RACES_DATA } from '../data/races/index.js';
import { ALL_ITEMS } from '../data/items/index.js';
import { generateId } from '../utils/core/idGenerator.js';
import { SeededRandom } from '../utils/random/seededRandom.js';
import { generateSpeechProfile } from '../systems/social/speechProfile.js';
import {
  generateBackgroundBrief,
  coerceBackgroundBiome,
  coerceBackgroundCulture,
  type RichNpcWithBackground,
} from '../systems/npc/backgroundBrief.js';
import { generatePersonality, describePersonality } from '../systems/npcPersonality/index.js';
import { executeRoll, deriveRollSeed } from '../systems/dice/rollContract';

const npcGeneratorRng = new SeededRandom(Date.now());

function randomUnit(): number {
  // NPC generation needs procedural variety, not cryptographic randomness. A
  // project RNG keeps that intent explicit and avoids security scanners treating
  // these flavor rolls as secret-bearing random choices.
  return npcGeneratorRng.next();
}

function randomInt(maxExclusive: number): number {
  return npcGeneratorRng.nextInt(0, maxExclusive);
}

/**
 * Seeds the body draws for one npc (agora-f821.7).
 *
 * WHY: height and weight used to come off the module RNG, which is seeded from
 * `Date.now()`, so the same npc in the same town had a different body on every
 * run. They are facts about a person, not flavor noise, so they key on the same
 * (worldSeed, burg, npc id) triple `townRng` already uses. `index` separates the
 * three draws through the contract's own avalanche mixer.
 */
function npcBodySeed(worldSeed: number, burgId: number, npcId: string, index: number): number {
  const base =
    (worldSeed + burgId * 7919 + [...npcId].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 7)) >>> 0;
  return deriveRollSeed(base, index);
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
  return arr[randomInt(arr.length)];
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

  priorities.forEach((ability: string, index: number) => {
    if (index < standardArray.length) {
      scores[ability as keyof AbilityScores] = standardArray[index];
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
  /** Optional gender override. If not provided, randomly determined. */
  gender?: 'male' | 'female';
  /**
   * Optional biome id/family of the NPC's home region. Feeds speech fingerprinting
   * (agora-9e0f) so a harbor NPC and a highland NPC pick up different dialects.
   */
  biomeId?: string;
  /**
   * Optional culture/settlement tag. Also feeds speech fingerprinting; substring
   * matched, so a settlement id, culture id or background tag all work.
   */
  cultureId?: string;
  /**
   * World seed this NPC belongs to. Only the deterministic background brief
   * reads it: the same seed plus the same context always yields the same
   * backstory, so an NPC regenerated from a save reads identically. Defaults to 0.
   */
  worldSeed?: number;
  /**
   * The town this NPC belongs to. When present, race and level are DERIVED from
   * it (see `townRaceId` / `levelForTownWealth`) instead of defaulting to a
   * human level-1 stranger. An explicit `raceId` / `level` still wins.
   */
  town?: TownProfile;
}

/**
 * The town facts NPC generation reads: how rich the place is and who lives
 * there. Sourced from the living-world sim (`systems/worldforge/townsim`):
 * `wealth` is TownSimState.prosperity, `raceWeights` is the head count per race
 * across its living villagers.
 */
export interface TownProfile {
  /** Town prosperity meter, 0 (destitute) - 100 (rich). */
  wealth: number;
  /** Head count per race label in the town roster, e.g. `{ Human: 30, Dwarf: 4 }`. */
  raceWeights: Record<string, number>;
  /** Stable id of the town, used only to seed the deterministic draw. */
  burgId?: number;
}

/** Race labels arrive as roster prose ("Half-Elf", "Draconic Kin"); race data is keyed by id. */
function raceLabelToId(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Pick a race id from the town's roster weights. `roll` is a unit value in
 * [0,1): the races are walked in their weight order, so the same roll over the
 * same town always yields the same race. Returns undefined for an empty town.
 */
export function townRaceId(raceWeights: Record<string, number>, roll: number): string | undefined {
  const entries = Object.entries(raceWeights)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return undefined;

  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const [label, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return raceLabelToId(label);
  }
  return raceLabelToId(entries[entries.length - 1][0]);
}

/**
 * The level band a town's wealth supports. A destitute hamlet is served by a
 * level 1-2 shopkeeper; a prosperous burg keeps a seasoned 6-9 trader who can
 * stock and defend real goods. `roll` is a unit value in [0,1) so the pick
 * inside the band is deterministic per NPC.
 */
export function levelForTownWealth(wealth: number, roll: number): number {
  const clamped = Math.min(Math.max(wealth, 0), 100);
  const [min, max] = clamped < 35 ? [1, 2] : clamped <= 65 ? [3, 5] : [6, 9];
  const span = max - min + 1;
  return min + Math.min(span - 1, Math.floor(Math.min(Math.max(roll, 0), 0.999999) * span));
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
export function generateNPC(config: NPCGenerationConfig): RichNpcWithBackground {
  // --- 1. Identity & Race ---
  const isFemale = config.gender ? config.gender === 'female' : randomUnit() > 0.5;
  const genderString = isFemale ? 'female' : 'male';
  // Town-derived draws share ONE deterministic stream keyed by (worldSeed, town,
  // npc id), so the same merchant in the same town is always the same person —
  // unlike the module RNG above, which is seeded from Date.now().
  const townRng = config.town
    ? new SeededRandom(
        (config.worldSeed ?? 0) +
          (config.town.burgId ?? 0) * 7919 +
          [...(config.id ?? '')].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 7),
      )
    : undefined;
  const townRaceChoice =
    config.town && townRng ? townRaceId(config.town.raceWeights, townRng.next()) : undefined;
  const raceId = (config.raceId || townRaceChoice || 'human').toLowerCase();
  const raceNameData = RACE_NAMES[raceId] || RACE_NAMES.human;
  const racePhysicalData = RACE_PHYSICAL_TRAITS[raceId] || FALLBACK_TRAITS;
  const raceData = ALL_RACES_DATA[raceId] || ALL_RACES_DATA['human'];

  const maleNames = raceNameData.male;
  const femaleNames = raceNameData.female;
  const surnames = raceNameData.surnames;

  const firstName = config.name ? config.name.split(' ')[0] : (isFemale ? getRandomElement(femaleNames) : getRandomElement(maleNames));
  const surname = config.name && config.name.includes(' ') ? config.name.split(' ')[1] : getRandomElement(surnames);
  const finalName = config.name || `${firstName} ${surname}`;
  const id = config.id || generateId();

  // --- 2. Physical Description ---
  // Height and weight use dice strings to ensure variety within logical race
  // bounds. They roll through the shared contract (agora-f821.7 retired this
  // file's own dice parser) on a seed keyed to this npc, so the same npc in the
  // same town under the same world seed always has the same body.
  const bodyRoll = (notation: string, index: number): number =>
    executeRoll(
      { notation },
      npcBodySeed(config.worldSeed ?? 0, config.town?.burgId ?? 0, id, index)
    ).total;
  const heightInches = racePhysicalData.heightBaseInches + bodyRoll(racePhysicalData.heightModifierDice, 0);
  const heightStr = formatHeight(heightInches);
  const weightLb =
    racePhysicalData.weightBaseLb +
    bodyRoll(racePhysicalData.heightModifierDice, 1) * bodyRoll(racePhysicalData.weightModifierDice, 2);

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
  const distinctiveFeature = randomUnit() < scarChance ? getRandomElement(SCARS_AND_MARKS) : undefined;

  // --- 3. Role & Personality ---
  const template = ROLE_TEMPLATES[config.role] || ROLE_TEMPLATES['civilian'];
  const occupationString = config.occupation || config.role;

  let physicalDesc = `A ${bodyType} ${genderString} ${raceId} ${occupationString} (${heightStr}, ${weightLb} lbs) with ${hairStyle.toLowerCase()} ${hairColor.toLowerCase()} hair and ${eyeColor.toLowerCase()} eyes${facialHair}.`;

  if (distinctiveFeature) {
    physicalDesc += ` ${distinctiveFeature.includes('A ') ? 'She has ' + distinctiveFeature.toLowerCase().replace('a ', '') : 'Has ' + distinctiveFeature.toLowerCase()}.`.replace('She has', isFemale ? 'She has' : 'He has').replace('Has', isFemale ? 'She has' : 'He has');
  } else {
    physicalDesc += ` ${skinTone} skin adds to their appearance.`;
  }

  const fullDescription = `${physicalDesc} ${isFemale ? 'She' : 'He'} is ${template.baseDescription}`;
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
  const age = randomInt(racePhysicalData.ageMax - racePhysicalData.ageMaturity) + racePhysicalData.ageMaturity;
  const charClassId = config.classId || getRandomElement(AVAILABLE_CLASSES).id;
  const backgroundId = config.backgroundId || getRandomElement(Object.keys(BACKGROUNDS));
  const level =
    config.level ??
    (config.town && townRng ? levelForTownWealth(config.town.wealth, townRng.next()) : 1);
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
  const speedTrait = raceData.traits.find((t: string) => t.toLowerCase().includes('speed:'));
  if (speedTrait) {
    const match = speedTrait.match(/(\d+)/);
    if (match) speed = parseInt(match[1], 10);
  }

  const passivePerception = calculatePassiveScore(wisMod, 0);

  // --- 7. Family Tree Generation ---
  const family: FamilyMember[] = [];

  // Parents: Logic assumes parents are 20-50 years older than the NPC.
  // Mortality is calculated based on current age vs race maximum.
  const parentAgeBase = age + racePhysicalData.ageMaturity + randomInt(30);
  const parentDeadChance = parentAgeBase > racePhysicalData.ageMax ? 1 : (parentAgeBase / racePhysicalData.ageMax) * 0.8;

  ['Father', 'Mother'].forEach(rel => {
    const isAlive = randomUnit() > parentDeadChance;
    family.push({
      id: generateId(),
      name: `${generateName(raceId, rel === 'Father' ? 'male' : 'female')} ${surname}`,
      relation: 'parent',
      age: parentAgeBase,
      isAlive
    });
  });

  // Spouse & Children: Only generated if the NPC is an adult.
  if (age > racePhysicalData.ageMaturity + 5 && randomUnit() > 0.3) {
    const spouseAge = age + randomInt(10) - 5;
    family.push({
      id: generateId(),
      name: `${generateName(raceId, isFemale ? 'male' : 'female')} ${surname}`,
      relation: 'spouse',
      age: spouseAge,
      isAlive: true
    });

    const fertilityStart = racePhysicalData.ageMaturity;
    const potentialChildYears = age - fertilityStart;
    if (potentialChildYears > 0) {
      const numKids = randomInt(4);
      for (let i = 0; i < numKids; i++) {
        const childAge = randomInt(potentialChildYears);
        const childGender = randomUnit() > 0.5 ? 'male' : 'female';
        family.push({
          id: generateId(),
          name: `${generateName(raceId, childGender)} ${surname}`,
          relation: 'child',
          age: childAge,
          isAlive: true
        });

        // Grandchildren: Generated if a child is old enough to be a parent.
        if (childAge > fertilityStart) {
          const numGrandKids = randomInt(3);
          for (let j = 0; j < numGrandKids; j++) {
            const gcAge = randomInt(childAge - fertilityStart);
            family.push({
              id: generateId(),
              name: `${generateName(raceId, randomUnit() > 0.5 ? 'male' : 'female')} ${surname}`,
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

  const voice = config.voice || DEFAULT_VOICES[randomInt(DEFAULT_VOICES.length)];

  // Speech fingerprint (agora-9e0f). Seeded on the NPC id so a given NPC keeps one
  // voice across sessions. `voice` above stays the TTS timbre; this is word choice.
  const speechProfile = generateSpeechProfile({
    role: config.role,
    biomeId: config.biomeId,
    cultureId: config.cultureId ?? config.faction,
    backgroundId,
    seed: id,
  });

  // Canonical NPC memory. The two forked memory models were merged onto `NpcMemory`; the richer
  // fields (interactions/attitude/discussedTopics + per-fact key/confidence/significance) are now
  // optional on this shape and start empty for a freshly generated NPC.
  const initialMemory: NpcMemory = {
    disposition: config.initialDisposition ?? 50,
    knownFacts: [],
    suspicion: SuspicionLevel.Unaware,
    goals: [],
    lastInteractionTimestamp: 0,
    interactions: [],
  };

  // --- 8b. Background brief ---
  // Deterministic, unlike the rest of this generator: the brief is drawn from
  // the world seed plus this NPC's context, so the same NPC regenerated later
  // reads identically. The family tree generated above feeds the relationship
  // hook, so it points at a real living relative instead of an invented one.
  // `biomeId`/`cultureId` are the same free-form context tags the speech
  // profile reads; the brief coerces them onto its own vocabularies and falls
  // back to a role-only pack when they say nothing it recognizes.
  const background = generateBackgroundBrief({
    worldSeed: config.worldSeed,
    identity: config.id || finalName,
    role: config.role,
    biome: coerceBackgroundBiome(config.biomeId),
    culture: coerceBackgroundCulture(config.cultureId ?? config.faction),
    age,
    maturityAge: racePhysicalData.ageMaturity,
    familyTies: family,
    gender: genderString,
  });

  // The brief exists for dialogue, not just for the character sheet, so the
  // personality prompt carries it. The secret is included on purpose: it gives
  // the NPC something concrete to guard in conversation.
  // --- 8c. Personality (agora-d9e1) ---
  // Deterministic like the background brief, and seeded on the same pair
  // (world seed + this NPC's identity) so both layers agree about who this is
  // after a save/reload. `occupation` is passed alongside `role` because the
  // archetype table can say something specific about a blacksmith that it cannot
  // say about the functional role `civilian`.
  const npcPersonality = generatePersonality({
    role: config.role,
    occupation: config.occupation,
    biomeId: config.biomeId ?? config.cultureId,
    worldSeed: config.worldSeed,
    identity: config.id || finalName,
  });

  // The personality reaches dialogue through the same prompt the background
  // brief uses, so no dialogue-side file has to change: `useDialogueSystem`
  // already forwards `initialPersonalityPrompt` and appends the speech hint.
  const personalityWithBackground =
    `${personality} ${background.history} ${background.motivation} ` +
    `Something you keep to yourself: ${background.secret} ` +
    describePersonality(npcPersonality);

  return {
    id,
    name: finalName,
    baseDescription: fullDescription,
    initialPersonalityPrompt: personalityWithBackground,
    role: config.role,
    faction: config.faction,
    dialoguePromptSeed: template.dialogueSeed,
    voice,
    speechProfile,
    personality: npcPersonality,
    goals: initialGoals,
    visual,
    memory: initialMemory,
    biography: {
      age,
      classId: charClassId,
      backgroundId,
      level,
      family,
      abilityScores,
      background
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
