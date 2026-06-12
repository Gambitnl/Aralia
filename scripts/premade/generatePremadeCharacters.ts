/**
 * Generates premade character JSON files from compact build specs.
 *
 * Each spec mirrors the choices a player made in the character creator during
 * the 2026-06-11 twenty-character flow audit. Characters are assembled through
 * the creator's real pipeline (`assemblePlayerCharacter`) so the output JSON
 * matches what "Begin Adventure!" would have produced — including background
 * skills, racial grants, age modifiers, and feat application.
 *
 * Usage:  npx tsx scripts/premade/generatePremadeCharacters.ts
 * Output: public/premade-characters/<name>.json + manifest.json entries
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_RACES_DATA } from '../../src/data/races/index';
import { CLASSES_DATA } from '../../src/data/classes/index';
import { SKILLS_DATA } from '../../src/data/skills/index';
import { BACKGROUNDS } from '../../src/data/backgrounds';
import {
  assemblePlayerCharacter,
} from '../../src/components/CharacterCreator/hooks/useCharacterAssembly';
import {
  initialCharacterCreatorState,
  type CharacterCreationState,
  type FeatChoiceState,
} from '../../src/components/CharacterCreator/state/characterCreatorState';
import type { AbilityScores, AbilityScoreName, FightingStyle, Spell } from '../../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'public', 'premade-characters');
const SPELL_BUNDLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'data', 'spells_bundle.json'), 'utf8'),
) as Record<string, Spell>;

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES: AbilityScoreName[] = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

interface PremadeSpec {
  file: string;
  name: string;
  description: string;
  raceId: string;
  classId: string;
  background: string;
  age: number;
  gender: 'Male' | 'Female';
  skinColor?: number;
  hairStyle?: string;
  /** Skills picked on the class Skills step (not racial/background grants). */
  classSkills: string[];
  cantrips?: string[];
  spellsL1?: string[];
  fightingStyleId?: string;
  divineOrder?: 'Protector' | 'Thaumaturge';
  druidOrder?: 'Magician' | 'Warden';
  masteries?: string[];
  racialSelections?: CharacterCreationState['racialSelections'];
  /** Choices for the background's origin feat (feat id comes from the background). */
  originFeatChoices?: FeatChoiceState;
  racialFeatId?: string;
  racialFeatChoices?: FeatChoiceState;
}

/** Same algorithm as AbilityScoreAllocation's "Apply <Class> Recommended". */
function recommendedScores(classId: string): AbilityScores {
  const cls = CLASSES_DATA[classId];
  if (!cls?.recommendedPointBuyPriorities) throw new Error(`No recommended priorities for ${classId}`);
  const scores = Object.fromEntries(ABILITIES.map(a => [a, 8])) as AbilityScores;
  const pool = [...STANDARD_ARRAY];
  cls.recommendedPointBuyPriorities.forEach((ability, idx) => {
    if (idx < pool.length) scores[ability] = pool[idx];
  });
  const assigned = new Set(cls.recommendedPointBuyPriorities);
  let next = cls.recommendedPointBuyPriorities.length;
  ABILITIES.forEach(ability => {
    if (!assigned.has(ability) && next < pool.length) scores[ability] = pool[next++];
  });
  return scores;
}

function spell(id: string): Spell {
  const s = SPELL_BUNDLE[id];
  if (!s) throw new Error(`Spell id not found in bundle: ${id}`);
  return s;
}

function skill(id: string) {
  const s = SKILLS_DATA[id];
  if (!s) throw new Error(`Skill id not found: ${id}`);
  return s;
}

function fightingStyle(classId: string, styleId: string): FightingStyle {
  const cls = CLASSES_DATA[classId];
  const style = cls?.fightingStyles?.find(f => f.id === styleId);
  if (!style) throw new Error(`Fighting style ${styleId} not found on ${classId}`);
  return style;
}

function buildState(spec: PremadeSpec): CharacterCreationState {
  const race = ALL_RACES_DATA[spec.raceId];
  if (!race) throw new Error(`Race id not found: ${spec.raceId}`);
  const cls = CLASSES_DATA[spec.classId];
  if (!cls) throw new Error(`Class id not found: ${spec.classId}`);
  const background = BACKGROUNDS[spec.background];
  if (!background) throw new Error(`Background id not found: ${spec.background}`);

  const scores = recommendedScores(spec.classId);
  const featChoices: Record<string, FeatChoiceState> = {};
  if (spec.originFeatChoices) featChoices[background.originFeatId] = spec.originFeatChoices;
  if (spec.racialFeatId && spec.racialFeatChoices) featChoices[spec.racialFeatId] = spec.racialFeatChoices;

  return {
    ...initialCharacterCreatorState,
    selectedRace: race,
    selectedClass: cls,
    baseAbilityScores: scores,
    finalAbilityScores: { ...scores },
    selectedSkills: spec.classSkills.map(skill),
    selectedCantrips: (spec.cantrips ?? []).map(spell),
    selectedSpellsL1: (spec.spellsL1 ?? []).map(spell),
    selectedFightingStyle: spec.fightingStyleId ? fightingStyle(spec.classId, spec.fightingStyleId) : null,
    selectedDivineOrder: spec.divineOrder ?? null,
    selectedDruidOrder: spec.druidOrder ?? null,
    selectedWeaponMasteries: spec.masteries ?? null,
    racialSelections: spec.racialSelections ?? {},
    backgroundFeatId: background.originFeatId,
    racialFeatId: spec.racialFeatId ?? null,
    featChoices,
    characterAge: spec.age,
    selectedBackground: spec.background,
    visuals: {
      ...initialCharacterCreatorState.visuals,
      gender: spec.gender,
      skinColor: spec.skinColor ?? 1,
      hairStyle: spec.hairStyle ?? 'Hair1',
    },
    visualDescription: `A high fantasy character portrait of a level 1 ${race.name} ${cls.name}. ${spec.gender} adventurer. Head-and-shoulders, detailed, dramatic lighting, neutral background.`,
  };
}

const SPECS: PremadeSpec[] = [
  {
    file: 'borin_vance.json', name: 'Borin Vance',
    description: 'A scarred human soldier who swings the heaviest blade on the field.',
    raceId: 'human', classId: 'fighter', background: 'soldier', age: 32, gender: 'Male', skinColor: 3, hairStyle: 'Hair2',
    classSkills: ['athletics', 'intimidation'],
    fightingStyleId: 'great_weapon_fighting',
    masteries: ['greataxe', 'greatsword', 'halberd'],
    racialSelections: { human: { skillIds: ['perception'] } },
    racialFeatId: 'tough',
  },
  {
    file: 'lyrielle_vantas.json', name: 'Lyrielle Vantas',
    description: 'A sage-trained high elf wizard with a spellbook full of answers.',
    raceId: 'high_elf', classId: 'wizard', background: 'sage', age: 36, gender: 'Female',
    classSkills: ['insight', 'investigation'],
    cantrips: ['mage-hand', 'minor-illusion', 'ray-of-frost'],
    spellsL1: ['magic-missile', 'shield', 'mage-armor', 'detect-magic', 'sleep', 'burning-hands'],
    racialSelections: { high_elf: { spellAbility: 'Intelligence', selectedSpellIds: ['fire-bolt'] } },
    originFeatChoices: {
      selectedAbilityScore: 'Intelligence', selectedSpellSource: 'wizard',
      selectedCantrips: ['light', 'prestidigitation'], selectedLeveledSpells: ['find-familiar'],
    },
  },
  {
    file: 'zerakha_bronzeplate.json', name: 'Zerakha Bronzeplate',
    description: 'A bronze dragonborn acolyte armored in faith and heavy plate.',
    raceId: 'bronze_dragonborn', classId: 'cleric', background: 'acolyte', age: 25, gender: 'Male', skinColor: 4,
    classSkills: ['medicine', 'persuasion'],
    divineOrder: 'Protector',
    cantrips: ['guidance', 'sacred-flame', 'thaumaturgy'],
    spellsL1: ['bless', 'cure-wounds', 'healing-word', 'shield-of-faith'],
    originFeatChoices: {
      selectedAbilityScore: 'Wisdom', selectedSpellSource: 'cleric',
      selectedCantrips: ['sacred-flame', 'light'], selectedLeveledSpells: ['guiding-bolt'],
    },
  },
  {
    file: 'vexa_emberhorn.json', name: 'Vexa Emberhorn',
    description: 'An infernal tiefling stage performer whose magic burns as bright as her act.',
    raceId: 'infernal_tiefling', classId: 'sorcerer', background: 'entertainer', age: 24, gender: 'Female',
    classSkills: ['deception', 'persuasion'],
    cantrips: ['fire-bolt', 'ray-of-frost', 'light', 'mage-hand'],
    spellsL1: ['shield', 'magic-missile'],
    racialSelections: { infernal_tiefling: { spellAbility: 'Charisma' } },
  },
  {
    file: 'fizwick_cogglesworth.json', name: 'Fizwick Cogglesworth',
    description: 'An aging rock gnome noble who traded court life for the stage.',
    raceId: 'rock_gnome', classId: 'bard', background: 'noble', age: 74, gender: 'Male',
    classSkills: ['performance', 'persuasion', 'acrobatics'],
    cantrips: ['vicious-mockery', 'dancing-lights'],
    spellsL1: ['healing-word', 'faerie-fire', 'dissonant-whispers', 'charm-person'],
    originFeatChoices: { selectedSkills: ['insight', 'stealth', 'perception'] },
  },
  {
    file: 'thorgrim_anvilmar.json', name: 'Thorgrim Anvilmar',
    description: 'A veteran mountain dwarf soldier sworn to the forge gods.',
    raceId: 'mountain_dwarf', classId: 'paladin', background: 'soldier', age: 92, gender: 'Male',
    classSkills: ['athletics', 'religion'],
    spellsL1: ['bless', 'cure-wounds'],
    masteries: ['longsword', 'warhammer'],
    racialSelections: { mountain_dwarf: { toolIds: ['smiths_tools'] } },
  },
  {
    file: 'posy_underbough.json', name: 'Posy Underbough',
    description: 'A lightfoot halfling with quick fingers and a quicker exit.',
    raceId: 'lightfoot_halfling', classId: 'rogue', background: 'criminal', age: 28, gender: 'Female',
    classSkills: ['stealth', 'acrobatics', 'sleight_of_hand', 'perception'],
    masteries: ['shortsword', 'dagger'],
  },
  {
    file: 'seraphel_dawnwhisper.json', name: 'Seraphel Dawnwhisper',
    description: 'A hermit aasimar who bargained with something beyond the dawn.',
    raceId: 'protector_aasimar', classId: 'warlock', background: 'hermit', age: 45, gender: 'Male',
    classSkills: ['arcana', 'deception'],
    cantrips: ['eldritch-blast', 'minor-illusion'],
    spellsL1: ['hex', 'armor-of-agathys'],
    racialSelections: { protector_aasimar: { spellAbility: 'Charisma' } },
  },
  {
    file: 'mirri_swiftclaw.json', name: 'Mirri Swiftclaw',
    description: 'A tabaxi wilderness guide who speaks for the wild places.',
    raceId: 'tabaxi', classId: 'druid', background: 'guide', age: 31, gender: 'Female',
    classSkills: ['nature', 'animal_handling'],
    druidOrder: 'Magician',
    cantrips: ['druidcraft', 'guidance', 'produce-flame'],
    spellsL1: ['entangle', 'cure-wounds', 'faerie-fire', 'thunderwave'],
    originFeatChoices: {
      selectedAbilityScore: 'Wisdom', selectedSpellSource: 'druid',
      selectedCantrips: ['guidance', 'thorn-whip'], selectedLeveledSpells: ['cure-wounds'],
    },
  },
  {
    file: 'nyx_manyfaces.json', name: 'Nyx Manyfaces',
    description: 'A changeling street survivor who hunts wearing a hundred faces.',
    raceId: 'changeling', classId: 'ranger', background: 'urchin', age: 29, gender: 'Male',
    classSkills: ['survival', 'perception', 'athletics'],
    spellsL1: ['hunters-mark', 'cure-wounds'],
    masteries: ['longbow', 'shortsword'],
    racialSelections: { changeling: { skillIds: ['deception', 'insight'] } },
  },
  {
    file: 'korag_frostpeak.json', name: 'Korag Frostpeak',
    description: 'A frost giant goliath farmer whose temper froze long ago.',
    raceId: 'frost_giant_goliath', classId: 'barbarian', background: 'farmer', age: 38, gender: 'Male',
    classSkills: ['athletics', 'intimidation'],
    masteries: ['greataxe', 'maul'],
    racialFeatId: undefined,
  },
  {
    file: 'ghazka_tidebreaker.json', name: 'Ghazka Tidebreaker',
    description: 'An orc sailor whose fists hit harder than a boarding axe.',
    raceId: 'orc', classId: 'monk', background: 'sailor', age: 22, gender: 'Male',
    classSkills: ['acrobatics', 'stealth'],
    masteries: ['quarterstaff', 'dagger'],
    originFeatChoices: { selectedAbilityScore: 'Strength' },
  },
  {
    file: 'cindra_ashveil.json', name: 'Cindra Ashveil',
    description: 'A fire genasi tinkerer running schemes for a shadowy faction.',
    raceId: 'fire_genasi', classId: 'artificer', background: 'faction-agent', age: 27, gender: 'Female',
    classSkills: ['arcana', 'investigation'],
    cantrips: ['mending', 'fire-bolt'],
    spellsL1: ['cure-wounds', 'identify'],
    racialSelections: { fire_genasi: { spellAbility: 'Intelligence' } },
  },
  {
    file: 'vlaakith_szarn.json', name: 'Vlaakith Szarn',
    description: 'A githyanki raider who never misses twice.',
    raceId: 'githyanki', classId: 'fighter', background: 'criminal', age: 33, gender: 'Male',
    classSkills: ['acrobatics', 'perception'],
    fightingStyleId: 'archery',
    masteries: ['longbow', 'shortbow', 'hand_crossbow'],
    racialSelections: { githyanki: { spellAbility: 'Intelligence' } },
  },
  {
    file: 'sylvaris_frostbloom.json', name: 'Sylvaris Frostbloom',
    description: 'An elderly winter eladrin scholar who steals secrets, not coin.',
    raceId: 'winter_eladrin', classId: 'rogue', background: 'sage', age: 88, gender: 'Male',
    classSkills: ['stealth', 'insight', 'acrobatics', 'investigation'],
    masteries: ['rapier', 'dagger'],
    originFeatChoices: {
      selectedAbilityScore: 'Intelligence', selectedSpellSource: 'wizard',
      selectedCantrips: ['mage-hand', 'message'], selectedLeveledSpells: ['feather-fall'],
    },
  },
  {
    file: 'unit_seven_tin.json', name: 'Unit Seven-Tin',
    description: 'A young warforged who farms in peace and fights like a fortress.',
    raceId: 'warforged', classId: 'fighter', background: 'farmer', age: 9, gender: 'Male',
    classSkills: ['athletics', 'survival'],
    fightingStyleId: 'defense',
    masteries: ['longsword', 'warhammer', 'halberd'],
    racialSelections: { warforged: { skillIds: ['perception'], toolIds: ['tinkers_tools'] } },
    racialFeatId: 'tough',
  },
  {
    file: 'bramwen_mosshollow.json', name: 'Bramwen Mosshollow',
    description: 'A firbolg hermit channeling quiet thunder for the old faith.',
    raceId: 'firbolg', classId: 'cleric', background: 'hermit', age: 52, gender: 'Male',
    classSkills: ['insight', 'persuasion'],
    divineOrder: 'Thaumaturge',
    cantrips: ['guidance', 'sacred-flame', 'thaumaturgy', 'word-of-radiance'],
    spellsL1: ['bless', 'healing-word', 'guiding-bolt', 'sanctuary'],
    racialSelections: { firbolg: { spellAbility: 'Wisdom' } },
  },
  {
    file: 'corvan_duskwhisper.json', name: 'Corvan Duskwhisper',
    description: 'A half-elf noble whose patron collects favors, not gold.',
    raceId: 'half_elf', classId: 'warlock', background: 'noble', age: 41, gender: 'Male',
    classSkills: ['deception', 'arcana'],
    cantrips: ['eldritch-blast', 'mage-hand'],
    spellsL1: ['charm-person', 'hex'],
    racialSelections: { half_elf: { skillIds: ['persuasion', 'intimidation'] } },
    originFeatChoices: { selectedSkills: ['insight', 'perception', 'stealth'] },
  },
  {
    file: 'maelis_deepcurrent.json', name: 'Maelis Deepcurrent',
    description: 'A triton sailor with a storm in his blood and a grudge to settle.',
    raceId: 'triton', classId: 'barbarian', background: 'sailor', age: 35, gender: 'Male',
    classSkills: ['survival', 'animal_handling'],
    masteries: ['greataxe', 'javelin'],
    racialSelections: { triton: { spellAbility: 'Charisma' } },
    originFeatChoices: { selectedAbilityScore: 'Constitution' },
  },
  {
    file: 'wrenna_thornquill.json', name: 'Wrenna Thornquill',
    description: 'A beastborn human guide whose spellbook smells of pine and rain.',
    raceId: 'beastborn_human', classId: 'wizard', background: 'guide', age: 26, gender: 'Female',
    classSkills: ['history', 'investigation'],
    cantrips: ['fire-bolt', 'mage-hand', 'light'],
    spellsL1: ['magic-missile', 'shield', 'mage-armor', 'sleep', 'detect-magic', 'thunderwave'],
    racialSelections: { beastborn_human: { skillIds: ['insight'] } },
    originFeatChoices: {
      selectedAbilityScore: 'Wisdom', selectedSpellSource: 'druid',
      selectedCantrips: ['druidcraft', 'guidance'], selectedLeveledSpells: ['goodberry'],
    },
    racialFeatId: 'alert',
  },
];

function main() {
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    characters: Array<{ filename: string; name: string; race: string; className: string; level: number; description: string; isTestFixture?: boolean }>;
  };

  let written = 0;
  for (const spec of SPECS) {
    const state = buildState(spec);
    const character = assemblePlayerCharacter(state, spec.name);
    if (!character) {
      throw new Error(`Assembly failed for ${spec.name} — check spec completeness (race/class selections).`);
    }
    // Stable id so re-running the generator doesn't churn the files.
    character.id = `premade_${spec.file.replace(/\.json$/, '')}`;

    fs.writeFileSync(path.join(OUT_DIR, spec.file), JSON.stringify(character, null, 2));
    written++;

    const entry = {
      filename: spec.file,
      name: spec.name,
      race: character.race.name,
      className: character.class.name,
      level: 1,
      description: spec.description,
    };
    const existing = manifest.characters.findIndex(c => c.filename === spec.file);
    if (existing >= 0) manifest.characters[existing] = { ...manifest.characters[existing], ...entry };
    else manifest.characters.push(entry);

    console.log(`✓ ${spec.name} (${character.race.name} ${character.class.name}) — HP ${character.maxHp}, AC ${character.armorClass}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${written} premade characters and updated manifest.json (${manifest.characters.length} total entries).`);
}

main();
