/**
 * @file src/data/classes/tierOneFeatures.ts
 * Level 2 and 3 class features (the tier-1 progression), keyed by class id.
 *
 * The base CLASSES_DATA `features` arrays only define level-1 features, so a
 * leveled character gained no new class content on the sheet — level 2–3 read as
 * "a level-1 character with more HP." This supplies the standard 2024-PHB level
 * 2–3 features (including the level-3 subclass milestone) so progression shows up.
 *
 * Surfaced via `classFeaturesForLevel` (see ./classFeatureProgression.ts), which
 * merges these with the base level-1 features filtered to the character's level.
 * Kept separate from CLASSES_DATA on purpose: many creation-time UIs render
 * `class.features` unfiltered, and we don't want level-2/3 features showing as
 * already-owned at level 1.
 */
import { ClassFeature } from '../../types/character';

/** The level-3 subclass milestone, shared shape across classes. */
const subclassFeature = (label: string): ClassFeature => ({
  id: 'subclass_choice',
  name: `Subclass: ${label}`,
  description: `At level 3 you choose a ${label}, gaining its distinctive features. This choice defines your character's specialty for the rest of their career.`,
  levelAvailable: 3,
});

export const TIER_ONE_FEATURES: Record<string, ClassFeature[]> = {
  fighter: [
    { id: 'action_surge', name: 'Action Surge', description: 'Once per short or long rest, take one additional action on your turn.', levelAvailable: 2 },
    { id: 'tactical_mind', name: 'Tactical Mind', description: 'Spend Second Wind uses to add 1d10 to a failed ability check.', levelAvailable: 2 },
    subclassFeature('Fighter subclass'),
  ],
  barbarian: [
    { id: 'danger_sense', name: 'Danger Sense', description: 'Advantage on Dexterity saving throws against effects you can see.', levelAvailable: 2 },
    { id: 'reckless_attack', name: 'Reckless Attack', description: 'Attack with advantage on Strength melee attacks, but attacks against you also have advantage until your next turn.', levelAvailable: 2 },
    subclassFeature('Primal Path'),
  ],
  bard: [
    { id: 'expertise', name: 'Expertise', description: 'Double your proficiency bonus on two chosen skills.', levelAvailable: 2 },
    { id: 'jack_of_all_trades', name: 'Jack of All Trades', description: 'Add half your proficiency bonus to any ability check that doesn\'t already include it.', levelAvailable: 2 },
    subclassFeature('Bard College'),
  ],
  cleric: [
    { id: 'channel_divinity', name: 'Channel Divinity', description: 'Channel divine energy to fuel magical effects, such as turning undead. Regain uses on a rest.', levelAvailable: 2 },
    subclassFeature('Divine Domain'),
  ],
  druid: [
    { id: 'wild_shape', name: 'Wild Shape', description: 'Magically assume the shape of a beast you have seen. Regain uses on a rest.', levelAvailable: 2 },
    { id: 'wild_companion', name: 'Wild Companion', description: 'Expend a Wild Shape use to cast Find Familiar as a spirit animal.', levelAvailable: 2 },
    subclassFeature('Druid Circle'),
  ],
  ranger: [
    { id: 'ranger_fighting_style', name: 'Fighting Style', description: 'Adopt a fighting style that suits your combat approach.', levelAvailable: 2 },
    { id: 'roving', name: 'Roving', description: 'Your speed increases and you gain a climb and swim speed.', levelAvailable: 3 },
    subclassFeature('Ranger Conclave'),
  ],
  rogue: [
    { id: 'cunning_action', name: 'Cunning Action', description: 'Use a bonus action to Dash, Disengage, or Hide.', levelAvailable: 2 },
    { id: 'steady_aim', name: 'Steady Aim', description: 'Forgo movement to gain advantage on your next attack this turn.', levelAvailable: 3 },
    subclassFeature('Roguish Archetype'),
  ],
  paladin: [
    { id: 'paladin_fighting_style', name: 'Fighting Style', description: 'Adopt a fighting style that suits your martial calling.', levelAvailable: 2 },
    { id: 'divine_smite_feature', name: 'Divine Smite', description: 'Expend a spell slot to deal extra radiant damage on a melee weapon hit.', levelAvailable: 2 },
    { id: 'paladin_channel_divinity', name: 'Channel Divinity', description: 'Channel divine power for an oath-specific effect. Regain uses on a rest.', levelAvailable: 3 },
    subclassFeature('Sacred Oath'),
  ],
  monk: [
    { id: 'monks_focus', name: 'Monk\'s Focus', description: 'Gain Focus Points to fuel Flurry of Blows, Patient Defense, and Step of the Wind.', levelAvailable: 2 },
    { id: 'unarmored_movement', name: 'Unarmored Movement', description: 'Your speed increases while you wear no armor and use no shield.', levelAvailable: 2 },
    { id: 'deflect_attacks', name: 'Deflect Attacks', description: 'Use your reaction to reduce damage from an attack.', levelAvailable: 3 },
    subclassFeature('Monastic Tradition'),
  ],
  sorcerer: [
    { id: 'font_of_magic', name: 'Font of Magic', description: 'Gain Sorcery Points you can convert into spell slots and back.', levelAvailable: 2 },
    { id: 'metamagic', name: 'Metamagic', description: 'Twist your spells with Metamagic options such as Careful or Quickened Spell.', levelAvailable: 3 },
    subclassFeature('Sorcerous Origin'),
  ],
  warlock: [
    { id: 'eldritch_invocations', name: 'Eldritch Invocations', description: 'Learn fragments of forbidden knowledge that grant magical abilities.', levelAvailable: 2 },
    { id: 'magical_cunning', name: 'Magical Cunning', description: 'Once per short rest, perform a ritual to regain expended pact-magic spell slots.', levelAvailable: 2 },
    subclassFeature('Otherworldly Patron feature'),
  ],
  wizard: [
    { id: 'scholar', name: 'Scholar', description: 'Gain Expertise in an Arcana, History, Investigation, Medicine, Nature, or Religion skill you\'re proficient in.', levelAvailable: 2 },
    subclassFeature('Arcane Tradition'),
  ],
  artificer: [
    { id: 'infuse_item', name: 'Infuse Item', description: 'Imbue mundane items with magical infusions.', levelAvailable: 2 },
    subclassFeature('Artificer Specialist'),
  ],
};
