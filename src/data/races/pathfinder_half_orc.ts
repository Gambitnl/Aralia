/**
 * @file mark_of_finding_half_orc.ts
 * Defines the data for the Mark of Finding Half-Orc race in the Aralia RPG.
 * Half-orcs with the Mark of Finding possess exceptional tracking and locating abilities.
 */
import { Race } from '../../types';

export const MARK_OF_FINDING_HALF_ORC_DATA: Race = {
  id: 'pathfinder_half_orc',
  name: 'Pathfinder Half-Orc',
  baseRace: 'half_orc',
  description:
    'Inscribed with a sigil resembling a compass or eye, half-orcs bearing the Mark of Finding are blessed with an uncanny ability to locate people, objects, and hidden treasures. This hereditary gift grants them supernatural tracking skills and the power to sense the presence of their quarry across vast distances. Their mark glows when they focus on a target or uncover something hidden. These finder-touched individuals become legendary bounty hunters, prospectors, and seekers, their ability to find what others cannot making them invaluable trackers and guides.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Adrenaline Rush: You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
    'Relentless Endurance: When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can\'t do so again until you finish a Long Rest.',
    'Hunter\'s Intuition: When you make a Wisdom (Perception) or Wisdom (Survival) check, you can roll a d4 and add the number rolled to the ability check.',
    'Finder\'s Magic: You can cast the Hunter\'s Mark spell with this trait. Starting at 3rd level, you can also cast the Locate Object spell with it. Once you cast either spell with this trait, you can\'t cast that spell with it again until you finish a Long Rest. Wisdom is your spellcasting ability for these spells.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Finding Spells table are added to the spell list of your spellcasting class.',
  ],
  visual: {
    id: 'mark_of_finding_half_orc',
    color: '#8B4513',
    maleIllustrationPath: 'assets/images/races/mark_of_finding_half_orc_male.png',
    femaleIllustrationPath: 'assets/images/races/mark_of_finding_half_orc_female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'hunters-mark' },
    { minLevel: 3, spellId: 'locate-object' },
  ],
};
