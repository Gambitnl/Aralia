// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 17:18:42
 * Dependents: components/DesignPreview/steps/classes/ClassesShell.tsx, components/DesignPreview/steps/classes/index.ts
 * Imports: 26 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ComponentType } from 'react';
import BattleMasterDemo from './subclasses/fighter/BattleMasterDemo';
import ChampionDemo from './subclasses/fighter/ChampionDemo';
import BerserkerDemo from './subclasses/barbarian/BerserkerDemo';
import WildHeartDemo from './subclasses/barbarian/WildHeartDemo';
import CollegeOfLoreDemo from './subclasses/bard/CollegeOfLoreDemo';
import CollegeOfValorDemo from './subclasses/bard/CollegeOfValorDemo';
import LifeDomainDemo from './subclasses/cleric/LifeDomainDemo';
import LightDomainDemo from './subclasses/cleric/LightDomainDemo';
import CircleOfTheLandDemo from './subclasses/druid/CircleOfTheLandDemo';
import CircleOfTheMoonDemo from './subclasses/druid/CircleOfTheMoonDemo';
import HunterDemo from './subclasses/ranger/HunterDemo';
import BeastMasterDemo from './subclasses/ranger/BeastMasterDemo';
import ThiefDemo from './subclasses/rogue/ThiefDemo';
import AssassinDemo from './subclasses/rogue/AssassinDemo';
import OathOfDevotionDemo from './subclasses/paladin/OathOfDevotionDemo';
import OathOfVengeanceDemo from './subclasses/paladin/OathOfVengeanceDemo';
import WarriorOfTheOpenHandDemo from './subclasses/monk/WarriorOfTheOpenHandDemo';
import WarriorOfShadowDemo from './subclasses/monk/WarriorOfShadowDemo';
import DraconicSorceryDemo from './subclasses/sorcerer/DraconicSorceryDemo';
import WildMagicSorceryDemo from './subclasses/sorcerer/WildMagicSorceryDemo';
import FiendPatronDemo from './subclasses/warlock/FiendPatronDemo';
import ArchfeyPatronDemo from './subclasses/warlock/ArchfeyPatronDemo';
import EvokerDemo from './subclasses/wizard/EvokerDemo';
import AbjurerDemo from './subclasses/wizard/AbjurerDemo';
import AlchemistDemo from './subclasses/artificer/AlchemistDemo';
import ArmorerDemo from './subclasses/artificer/ArmorerDemo';

/**
 * This file is the disjoint registry for subclass-specific Classes demonstrations.
 * It exists so each sequential subclass leaf can contribute one local registration
 * without changing canonical class data, combat mechanics, or the Rules host.
 * Called by: ClassesShell.tsx and focused Classes-domain tests.
 * Depends on: the local subclass demo component contract, the existing Fighter,
 * Barbarian, Bard, and Cleric leaf demos.
 */

// ============================================================================
// Subclass Demo Contract
// ============================================================================
// Registrations identify the canonical pair and provide a component that owns its own
// deterministic controls. The shell uses this contract only after canonical selection.
export interface SubclassDemoRegistration {
  classId: string;
  subclassId: string;
  label: string;
  description: string;
  Component: ComponentType;
}

export type SubclassDemoRegistry = readonly SubclassDemoRegistration[];

// ============================================================================
// Sequential Leaf Registry
// ============================================================================
// The prior registrations remain first and unchanged in order. Each leaf appends one
// local registration so it owns its canonical progression and honest runtime gap
// boundary without changing class data, combat mechanics, or the Rules host.
export const SUBCLASS_DEMO_REGISTRY = [
  {
    classId: 'fighter',
    subclassId: 'champion',
    label: 'Champion',
    description: 'Improved Critical through the production combat pipeline.',
    Component: ChampionDemo,
  },
  {
    classId: 'fighter',
    subclassId: 'battle_master',
    label: 'Battle Master',
    description: 'canonical level-3 progression for Combat Superiority; combat runtime remains explicit.',
    Component: BattleMasterDemo,
  },
  {
    classId: 'barbarian',
    subclassId: 'berserker',
    label: 'Path of the Berserker',
    description: 'canonical level-3 progression for Frenzy; the incomplete combat lifecycle remains explicit.',
    Component: BerserkerDemo,
  },
  {
    classId: 'barbarian',
    subclassId: 'wild_heart',
    label: 'Path of the Wild Heart',
    description: 'canonical Bear Spirit Rage transaction through production status and resistance helpers.',
    Component: WildHeartDemo,
  },
  {
    classId: 'bard',
    subclassId: 'college_of_lore',
    label: 'College of Lore',
    description: 'canonical level-3 feature grants with Cutting Words and skill-choice runtime boundaries explicit.',
    Component: CollegeOfLoreDemo,
  },
  {
    classId: 'bard',
    subclassId: 'college_of_valor',
    label: 'College of Valor',
    description: 'canonical level-3 feature grants with Combat Inspiration and martial proficiency runtime boundaries explicit.',
    Component: CollegeOfValorDemo,
  },
  {
    classId: 'cleric',
    subclassId: 'life_domain',
    label: 'Life Domain',
    description: 'canonical level-3 feature grants with healing and prepared-spell runtime boundaries explicit.',
    Component: LifeDomainDemo,
  },
  {
    classId: 'cleric',
    subclassId: 'light_domain',
    label: 'Light Domain',
    description: 'canonical level-3 feature grants with Warding Flare and prepared-spell runtime boundaries explicit.',
    Component: LightDomainDemo,
  },
  {
    classId: 'druid',
    subclassId: 'circle_of_the_land',
    label: 'Circle of the Land',
    description: 'canonical level-3 feature grants with land-choice, recovery, and nature-feature runtime boundaries explicit.',
    Component: CircleOfTheLandDemo,
  },
  {
    classId: 'druid',
    subclassId: 'circle_of_the_moon',
    label: 'Circle of the Moon',
    description: 'canonical level-3 Circle Forms grant with Wild Shape, Moon spells, and lunar-feature runtime boundaries explicit.',
    Component: CircleOfTheMoonDemo,
  },
  {
    classId: 'ranger',
    subclassId: 'hunter',
    label: 'Hunter',
    description: "canonical level-3 Hunter's Prey grant with the unimplemented Prey-choice combat boundary explicit.",
    Component: HunterDemo,
  },
  {
    classId: 'ranger',
    subclassId: 'beast_master',
    label: 'Beast Master',
    description: 'canonical level-3 Primal Companion grant with the missing subclass-aware companion runtime boundary explicit.',
    Component: BeastMasterDemo,
  },
  {
    classId: 'rogue',
    subclassId: 'thief',
    label: 'Thief',
    description: 'canonical level-3 Fast Hands and Second-Story Work grants with the missing subclass-aware runtime boundary explicit.',
    Component: ThiefDemo,
  },
  {
    classId: 'rogue',
    subclassId: 'assassin',
    label: 'Assassin',
    description: "canonical level-3 Assassinate and Assassin's Tools grants with the missing subclass-aware runtime boundary explicit.",
    Component: AssassinDemo,
  },
  {
    classId: 'paladin',
    subclassId: 'oath_of_devotion',
    label: 'Oath of Devotion',
    description: 'canonical level-3 Channel Divinity and Sacred Weapon grants with the missing subclass-aware runtime boundary explicit.',
    Component: OathOfDevotionDemo,
  },
  {
    classId: 'paladin',
    subclassId: 'oath_of_vengeance',
    label: 'Oath of Vengeance',
    description: 'canonical level-3 Vow of Enmity ability creation with the missing chosen-foe runtime boundary explicit.',
    Component: OathOfVengeanceDemo,
  },
  {
    classId: 'monk',
    subclassId: 'open_hand',
    label: 'Warrior of the Open Hand',
    description: 'canonical level-3 Open Hand Technique grant with the missing Focus and Flurry rider runtime boundary explicit.',
    Component: WarriorOfTheOpenHandDemo,
  },
  {
    classId: 'monk',
    subclassId: 'shadow',
    label: 'Warrior of Shadow',
    description: 'canonical level-3 Shadow Arts grant with the missing Focus, darkness, vision, and Shadow Step runtime boundary explicit.',
    Component: WarriorOfShadowDemo,
  },
  {
    classId: 'sorcerer',
    subclassId: 'draconic',
    label: 'Draconic Sorcery',
    description: 'canonical level-3 Draconic Resilience AC and HP conversion with ancestry and elemental-affinity gaps explicit.',
    Component: DraconicSorceryDemo,
  },
  {
    classId: 'sorcerer',
    subclassId: 'wild_magic',
    label: 'Wild Magic Sorcery',
    description: 'canonical level-3 Wild Magic feature grants with surge, table, effect, Tides, and resource gaps explicit.',
    Component: WildMagicSorceryDemo,
  },
  {
    classId: 'warlock',
    subclassId: 'fiend',
    label: 'Fiend Patron',
    description: "canonical level-3 Dark One's Blessing binding and amount audit with the missing hostile-target guard explicit.",
    Component: FiendPatronDemo,
  },
  {
    classId: 'warlock',
    subclassId: 'archfey',
    label: 'Archfey Patron',
    description: 'canonical level-3 Steps of the Fey progression with the exact missing Fey Presence contract explicit.',
    Component: ArchfeyPatronDemo,
  },
  {
    classId: 'wizard',
    subclassId: 'evocation',
    label: 'Evoker (School of Evocation)',
    description: 'canonical level-3 Sculpt Spells progression with the exact missing ally-safe AoE and Potent Cantrip contract explicit.',
    Component: EvokerDemo,
  },
  {
    classId: 'wizard',
    subclassId: 'abjuration',
    label: 'Abjurer (School of Abjuration)',
    description: 'canonical level-3 Arcane Ward progression with the exact missing ward creation, recharge, and damage absorption contract explicit.',
    Component: AbjurerDemo,
  },
  {
    classId: 'artificer',
    subclassId: 'alchemist',
    label: 'Alchemist',
    description: 'canonical level-3 Experimental Elixir progression with the exact missing creation, roll, drink, effect, resource, and reset contract explicit.',
    Component: AlchemistDemo,
  },
  {
    classId: 'artificer',
    subclassId: 'armorer',
    label: 'Armorer',
    description: 'canonical level-3 Arcane Armor progression with the exact missing armor bond, Guardian/Infiltrator model, attack, resource, don/doff, and reset contract explicit.',
    Component: ArmorerDemo,
  },
] satisfies SubclassDemoRegistry;

// ============================================================================
// Registry Lookup
// ============================================================================
// Return only an exact canonical class/subclass match. Unknown or future selections
// intentionally return undefined so ClassesDomainShell can show its honest boundary.
export function getSubclassDemo(
  classId: string,
  subclassId: string | null | undefined,
): SubclassDemoRegistration | undefined {
  return SUBCLASS_DEMO_REGISTRY.find(
    registration => registration.classId === classId && registration.subclassId === subclassId,
  );
}
