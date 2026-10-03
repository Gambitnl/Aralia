/**
 * @file src/data/glossary/weaponMasteryData.ts
 *
 * This file contains the complete structured dataset of PHB 2024 Weapon Mastery properties.
 *
 * Why it exists:
 * Weapon Masteries are a marquee combat enhancement introduced in the 2024 Player's
 * Handbook. They give martial combatants (Fighters, Barbarians, Paladins, Rangers, and Rogues)
 * distinctive tactical choices per weapon (e.g. knocking enemies prone with Topple, cleaving
 * adjacent targets, or pushing enemies over cliffs without a save).
 *
 * Connects to:
 * - src/data/glossary/types.ts for WeaponMasteryEntry
 * - src/components/Compendium/WeaponMasteryTable.tsx for table rendering
 * - src/data/glossary/searchIndex.ts for search indexing
 */

import { WeaponMasteryEntry } from './types';

// ============================================================================
// Weapon Masteries Dataset
// ============================================================================
// All 8 official weapon mastery properties with prerequisite requirements,
// timing triggers, mechanical formulas, and standard weapons that grant them.
// ============================================================================

export const WEAPON_MASTERY_DATA: WeaponMasteryEntry[] = [
  {
    id: 'Cleave',
    name: 'Cleave',
    prerequisite: 'Melee Weapon, Heavy Property',
    trigger: 'On Hit (Once per Turn)',
    mechanic: 'If you hit a creature with a melee attack roll, you can make a second melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but without your ability modifier unless that modifier is negative.',
    standardWeapons: ['Greataxe', 'Halberd'],
    tacticalNotes: 'Excellent against clustered hordes and swarms. Lets heavy weapon wielders dispatch multiple minion foes in a single action.',
    seeAlso: ['weapon', 'attack_roll', 'damage_types', 'heavy_property', 'reach'],
  },
  {
    id: 'Graze',
    name: 'Graze',
    prerequisite: 'Melee Weapon, Heavy Property',
    trigger: 'On Miss with Attack Roll',
    mechanic: 'If your attack roll misses a creature, you still deal damage to that creature equal to the ability modifier you used with the attack roll (minimum of 0 damage). This damage cannot be increased in any way, nor can it trigger other attack riders.',
    standardWeapons: ['Glaive', 'Greatsword'],
    tacticalNotes: 'Guaranteed chip damage even against high-AC bosses or evasive enemies. Ensures your turn is never entirely wasted.',
    seeAlso: ['weapon', 'attack_roll', 'ability_score_and_modifier', 'heavy_property'],
  },
  {
    id: 'Nick',
    name: 'Nick',
    prerequisite: 'Light Weapon Property',
    trigger: 'When making an extra attack from Two-Weapon Fighting',
    mechanic: 'When you make the extra attack granted by the Light weapon property, you can make that attack as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
    standardWeapons: ['Dagger', 'Light Hammer', 'Scimitar', 'Sickle'],
    tacticalNotes: 'Frees up your Bonus Action for class features (such as Cunning Action, Spells, or Hunter’s Mark) while preserving full dual-wielding damage.',
    seeAlso: ['two_weapon_fighting', 'bonus_action', 'attack_action', 'light_property'],
  },
  {
    id: 'Push',
    name: 'Push',
    prerequisite: 'Heavy, Two-Handed, or Versatile Property',
    trigger: 'On Hit with Attack Roll',
    mechanic: 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from you if it is Large or smaller. No saving throw is allowed to resist the push.',
    standardWeapons: ['Greatclub', 'Heavy Crossbow', 'Pike', 'Warhammer'],
    tacticalNotes: 'Forced battlefield repositioning with zero saving throw. Ideal for knocking enemies into hazards, off cliffs, or out of melee reach to prevent opportunity attacks.',
    seeAlso: ['shove', 'difficult_terrain', 'opportunity_attack', 'heavy_property'],
  },
  {
    id: 'Sap',
    name: 'Sap',
    prerequisite: 'Versatile or Martial Melee Weapon without Heavy',
    trigger: 'On Hit with Attack Roll',
    mechanic: 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
    standardWeapons: ['Flail', 'Mace', 'Morningstar', 'Spear', 'War Pick'],
    tacticalNotes: 'High-utility defensive debuff for frontline tanks. Great against solo powerhouse bosses making heavy single attacks.',
    seeAlso: ['disadvantage', 'attack_roll', 'versatile_property'],
  },
  {
    id: 'Slow',
    name: 'Slow',
    prerequisite: 'Any Melee or Ranged Weapon',
    trigger: 'On Hit with Attack Roll',
    mechanic: 'If you hit a creature with this weapon and deal damage, you can reduce its Speed by 10 feet until the start of your next turn. If you hit the creature more than once with this property on a turn, the speed reductions do not stack.',
    standardWeapons: ['Club', 'Javelin', 'Longbow', 'Musket', 'Shortbow', 'Sling', 'Whip'],
    tacticalNotes: 'Crucial for ranged kiters and skirmishers. Stacking Slow with difficult terrain can completely prevent a melee enemy from closing the distance.',
    seeAlso: ['speed', 'difficult_terrain', 'dash_action', 'ranged_attack'],
  },
  {
    id: 'Topple',
    name: 'Topple',
    prerequisite: 'Heavy, Reach, or Versatile Property',
    trigger: 'On Hit with Attack Roll',
    mechanic: 'If you hit a creature with this weapon, you can force that creature to make a Constitution saving throw with a DC equal to 8 + your Strength modifier + your Proficiency Bonus. On a failed save, the creature has the Prone condition.',
    savingThrow: 'Constitution Save: DC 8 + Str Modifier + Proficiency Bonus',
    standardWeapons: ['Battleaxe', 'Lance', 'Maul', 'Trident'],
    tacticalNotes: 'Knocks targets Prone, granting you and all adjacent melee allies Advantage on subsequent attack rolls against the victim.',
    seeAlso: ['prone', 'saving_throw', 'advantage', 'unarmed_strike'],
  },
  {
    id: 'Vex',
    name: 'Vex',
    prerequisite: 'Light or Finesse Property',
    trigger: 'On Hit with Attack Roll',
    mechanic: 'If you hit a creature with this weapon and deal damage, you gain Advantage on your next attack roll against that creature before the end of your next turn.',
    standardWeapons: ['Blowgun', 'Dart', 'Hand Crossbow', 'Handaxe', 'Rapier', 'Shortsword'],
    tacticalNotes: 'Creates an Advantage-loop chain for Rogues (triggering Sneak Attack every turn) and fast duelists.',
    seeAlso: ['advantage', 'attack_roll', 'finesse_property', 'light_property', 'sneak_attack'],
  },
];
