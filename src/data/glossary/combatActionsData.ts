/**
 * @file src/data/glossary/combatActionsData.ts
 *
 * This file contains the complete structured dataset of PHB 2024 combat actions
 * and reaction triggers.
 *
 * Why it exists:
 * The 2024 revision overhauled combat actions by introducing the unified "Magic"
 * action (encompassing spellcasting and activating magical items/features), clarifying
 * the "Study" and "Search" actions for skill checks in initiative, and formalizing
 * Unarmed Strike options (Damage, Grapple, Shove) under the Attack action.
 *
 * Connects to:
 * - src/data/glossary/types.ts for CombatActionEntry and ActionEconomyType
 * - src/components/Compendium/CombatActionsTable.tsx for table rendering
 * - src/data/glossary/searchIndex.ts for search indexing
 */

import { CombatActionEntry } from './types';

// ============================================================================
// Combat Actions Dataset
// ============================================================================
// The canonical PHB 2024 combat actions, classified by action economy cost
// and detailed mechanical steps.
// ============================================================================

export const COMBAT_ACTIONS_DATA: CombatActionEntry[] = [
  {
    id: 'attack_action',
    name: 'Attack',
    actionType: 'Action',
    summary: 'Make one or more melee or ranged attacks, or replace an attack with an Unarmed Strike option (Damage, Grapple, or Shove).',
    detailedRules: [
      'Number of Attacks: By default you make one attack. If you have features like Extra Attack, you make multiple attacks with this action.',
      'Equipping / Drawing: You can draw or stow one weapon as part of each attack you make with this action.',
      'Weapon Attacks: Roll 1d20 + Ability Modifier + Proficiency Bonus (if proficient) vs target AC.',
      'Unarmed Strike Options: In place of a weapon attack, you can make an Unarmed Strike to deal 1 + Str damage, Grapple a target (DC 8 + Str mod + Prof), or Shove a target (push 5 ft or knock Prone; DC 8 + Str mod + Prof).',
    ],
    subtypesOrOptions: [
      'Melee Weapon Attack',
      'Ranged Weapon Attack',
      'Unarmed Strike: Damage',
      'Unarmed Strike: Grapple (Save DC = 8 + Str + Prof)',
      'Unarmed Strike: Shove (Push 5 ft or Prone, Save DC = 8 + Str + Prof)',
    ],
    phb2024Changes: 'Drawing/stowing weapons can now be done before or after EACH attack rather than once per turn. Grapple and Shove are now resolved via target saving throws against fixed DC rather than contested skill checks.',
    seeAlso: ['attack_roll', 'unarmed_strike', 'grappled', 'shove', 'prone', 'two_weapon_fighting'],
  },
  {
    id: 'magic_action',
    name: 'Magic (Cast a Spell / Use Magic)',
    actionType: 'Action',
    summary: 'Cast a spell that has a casting time of 1 action, or activate a magical class feature or magic item that requires a Magic action.',
    detailedRules: [
      'Spellcasting: Cast a spell you have prepared/known with a casting time of 1 action. You must provide Verbal, Somatic, and Material components as required.',
      'Magic Items & Features: Many magical items, wands, and supernatural class abilities (such as Wild Shape or Channel Divinity) use the Magic action to activate.',
      'Bonus Action Spells: If you cast a spell with a Bonus Action on your turn, any other spell you cast on that turn must be a cantrip with a casting time of 1 action.',
      'Concentration: Casting a spell with Concentration immediately ends any previous spell you were concentrating on.',
    ],
    subtypesOrOptions: [
      'Cast a Levelled Spell (1 Action)',
      'Cast a Cantrip (1 Action)',
      'Activate Magic Item Property',
      'Activate Magical Class Feature',
    ],
    phb2024Changes: '2024 Revision: Unified "Cast a Spell" and magical feature activations into a single standardized "Magic" action keyword.',
    seeAlso: ['spell', 'cantrip', 'concentration', 'spell_slots', 'spellcasting_focus', 'ritual'],
  },
  {
    id: 'dash_action',
    name: 'Dash',
    actionType: 'Action',
    summary: 'Gain extra movement equal to your Speed for the current turn.',
    detailedRules: [
      'Movement Bonus: When you take the Dash action, you gain extra movement equal to your Speed (after applying any active modifiers) for the current turn.',
      'Multiple Speeds: If you have special movement speeds (such as Fly, Swim, or Climb speeds), you can apply the Dash bonus to whichever speed you are using.',
    ],
    phb2024Changes: 'Clarified interaction with special movement modes and encumbrance modifiers.',
    seeAlso: ['speed', 'climb_speed', 'fly_speed', 'swim_speed', 'difficult_terrain'],
  },
  {
    id: 'disengage_action',
    name: 'Disengage',
    actionType: 'Action',
    summary: 'Your movement does not provoke Opportunity Attacks for the rest of your turn.',
    detailedRules: [
      'Safe Movement: Taking the Disengage action prevents all hostile creatures from making Opportunity Attacks against you when you leave their reach during the rest of your turn.',
      'Persistent for Turn: The benefit lasts until the end of your current turn, allowing you to move past multiple enemies safely.',
    ],
    phb2024Changes: 'Remains the essential mobility safeguard; Rogues and Monks frequently access this as a Bonus Action.',
    seeAlso: ['opportunity_attack', 'speed', 'reach', 'dodge_action'],
  },
  {
    id: 'dodge_action',
    name: 'Dodge',
    actionType: 'Action',
    summary: 'Focus entirely on defense: attacks against you have Disadvantage (if you can see the attacker), and you make Dexterity saving throws with Advantage.',
    detailedRules: [
      'Defensive Posture: Until the start of your next turn, any attack roll made against you has Disadvantage if you can see the attacker.',
      'Dexterity Save Advantage: You make Dexterity saving throws with Advantage.',
      'Loss of Benefit: You lose the benefits of Dodge early if you are Incapacitated or if your Speed drops to 0.',
    ],
    phb2024Changes: 'Explicitly specifies that sight of the attacker is required to impose Disadvantage.',
    seeAlso: ['advantage', 'disadvantage', 'dexterity', 'saving_throw', 'incapacitated'],
  },
  {
    id: 'help_action',
    name: 'Help',
    actionType: 'Action',
    summary: 'Lend your aid to an ally: grant Advantage on an ally’s next ability check, or feint to grant Advantage on an ally’s next attack roll against a foe within 5 ft.',
    detailedRules: [
      'Assisting an Ability Check: You assist an ally with an ability check before the start of your next turn. The ally gains Advantage on that check (you must be capable of performing the task yourself).',
      'Assisting an Attack: You distract or feint an enemy within 5 feet of you. The next attack roll made by an ally against that enemy before the start of your next turn has Advantage.',
    ],
    subtypesOrOptions: [
      'Help on Ability Check (Advantage to ally)',
      'Help on Attack Roll (Advantage vs target within 5 ft)',
    ],
    phb2024Changes: 'Clarifies that helping on ability checks requires the helper to have proficiency or practical capacity to assist with the task.',
    seeAlso: ['advantage', 'ability_check', 'attack_roll', 'flanking'],
  },
  {
    id: 'hide_action',
    name: 'Hide',
    actionType: 'Action',
    summary: 'Make a DC 15 Dexterity (Stealth) check while Heavily Obscured or behind Three-Quarters/Total Cover to gain the Invisible condition until found or loud.',
    detailedRules: [
      'Stealth Check: Make a Dexterity (Stealth) check. The DC is 15.',
      'Requirements: You must be out of line of sight from enemies (Three-Quarters Cover, Total Cover, or Heavily Obscured).',
      'Invisible Benefit: On a success, you gain the Invisible condition relative to creatures from whom you are hidden.',
      'Breaking Stealth: Your hiding ends immediately if you make a sound louder than a whisper, make an attack roll, cast a spell with a verbal component, or an enemy spots you.',
    ],
    phb2024Changes: '2024 Revision: Hiding now uses a standardized DC 15 Dexterity (Stealth) check and explicitly bestows the "Invisible" condition until broken or detected, dramatically simplifying stealth mechanics.',
    seeAlso: ['invisible', 'heavily_obscured', 'three_quarters_cover', 'total_cover', 'search_action'],
  },
  {
    id: 'ready_action',
    name: 'Ready',
    actionType: 'Action',
    summary: 'Wait for a specific trigger before acting: specify a perceivable trigger and the action/movement you will take as a Reaction.',
    detailedRules: [
      'Specify Trigger: Decide what perceivable circumstance will trigger your reaction (e.g. "If the goblin steps through the doorway...").',
      'Specify Response: Decide the specific action you will take, or move up to your Speed.',
      'Reaction Cost: When the trigger occurs, you can either take your Reaction right after the trigger finishes or ignore the trigger.',
      'Readying a Spell: When you ready a spell, you cast it as normal with your Action but hold its energy. This requires Concentration until released; if your concentration is broken, the spell slot is lost.',
    ],
    triggerOrPrerequisite: 'Perceivable trigger event defined on your turn.',
    phb2024Changes: 'Holding a readied spell continues to require Concentration; spell slot is expended immediately when readied.',
    seeAlso: ['reaction', 'concentration', 'opportunity_attack', 'magic_action'],
  },
  {
    id: 'search_action',
    name: 'Search',
    actionType: 'Action',
    summary: 'Devote your attention to finding something hidden or concealed using a Wisdom (Insight, Medicine, Perception, or Survival) check.',
    detailedRules: [
      'Wisdom Ability Check: Make a Wisdom check depending on what you seek:',
      '• Perception: Spot hidden creatures (opposed to their Stealth check), concealed doors, or distant landmarks.',
      '• Insight: Discern a creature’s true intentions, mood, or deception in combat.',
      '• Medicine: Diagnose ailments, check vitals, or stabilize an ally.',
      '• Survival: Follow tracks, identify environmental tracks or hazards.',
    ],
    subtypesOrOptions: [
      'Wisdom (Perception): Spot hidden creatures or traps',
      'Wisdom (Insight): Read enemy intentions or tells',
      'Wisdom (Medicine): Examine injuries or status',
      'Wisdom (Survival): Identify tracks or hazard signs',
    ],
    phb2024Changes: '2024 Revision: Formalized as a dedicated Combat Action with specific Wisdom skill pairings.',
    seeAlso: ['hide_action', 'perception', 'insight', 'medicine', 'survival'],
  },
  {
    id: 'study_action',
    name: 'Study',
    actionType: 'Action',
    summary: 'Devote your attention to recalling lore or analyzing creature stats and magical anomalies with an Intelligence check.',
    detailedRules: [
      'Intelligence Ability Check: Make an Intelligence check depending on what you analyze:',
      '• Arcana: Identify spells, magical runes, planar anomalies, or Aberrations/Constructs/Elementals.',
      '• History: Recall historical military tactics, ancient kingdoms, or legendary items.',
      '• Investigation: Deduce weak points, decipher traps, or analyze mechanical contraptions.',
      '• Nature: Recall vulnerabilities, resistances, and traits of Beasts, Plants, Oozes, and Fey.',
      '• Religion: Identify Undead, Fiends, Celestials, cult symbols, and divine rituals.',
    ],
    subtypesOrOptions: [
      'Intelligence (Arcana): Magical lore and magical creature vulnerabilities',
      'Intelligence (History): Lore of war, factions, and ancient ruins',
      'Intelligence (Investigation): Clues, mechanical puzzles, and weak spots',
      'Intelligence (Nature): Flora, fauna, beasts, plants, and natural hazards',
      'Intelligence (Religion): Holy lore, undead, fiends, and celestial traits',
    ],
    phb2024Changes: '2024 Revision: Brand new dedicated Action in 2024 rules allowing characters to spend their action to learn monster resistances, weaknesses, and lore in mid-combat.',
    seeAlso: ['arcana', 'history', 'investigation', 'nature', 'religion', 'resistance', 'vulnerability'],
  },
  {
    id: 'utilize_action',
    name: 'Utilize (Use an Object)',
    actionType: 'Action',
    summary: 'Interact with more than one object or use a complex adventuring gear item (potions, healer’s kits, locks, or heavy levers).',
    detailedRules: [
      'Free Interaction: You can interact with one object or feature of the environment for free on your turn (e.g. opening an unlocked door).',
      'Utilize Action: If you wish to interact with a second object, manipulate a complex mechanism, drink a potion, or use a tool in combat, you use the Utilize action.',
      'Adventuring Gear: Using items like Caltrops, Ball Bearings, Hunting Traps, or Healer’s Kits takes the Utilize action.',
    ],
    phb2024Changes: '2024 Revision: Renamed "Use an Object" to the "Utilize" action; unified wording across all adventuring items and tools.',
    seeAlso: ['adventuring_equipment', 'potions', 'lockpicking', 'interacting_with_objects'],
  },
  {
    id: 'opportunity_attack',
    name: 'Opportunity Attack',
    actionType: 'Reaction',
    summary: 'Make one melee attack with a weapon or unarmed strike when a visible hostile creature moves out of your reach without Disengaging.',
    detailedRules: [
      'Trigger: A hostile creature that you can see moves out of your reach.',
      'Timing: The attack interrupts the creature’s movement, occurring right before the creature leaves your reach.',
      'Melee Only: You make one melee attack with a weapon or an Unarmed Strike.',
      'Exceptions: Teleportation, forced movement (being shoved, thrown, or falling), and moving while Disengaged do not trigger Opportunity Attacks.',
    ],
    triggerOrPrerequisite: 'Visible hostile creature leaves your melee reach without Disengaging.',
    phb2024Changes: 'Requires sight of the creature (creatures under the Invisible condition do not provoke Opportunity Attacks).',
    seeAlso: ['reaction', 'reach', 'disengage_action', 'invisible', 'teleportation'],
  },
];
