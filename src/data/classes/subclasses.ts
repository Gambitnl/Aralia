/**
 * @file src/data/classes/subclasses.ts
 * Subclasses (the level-3 milestone) per class, with the features each grants at
 * level 3 — the defining choice of tier 1. Before this, no subclass data existed,
 * so a level-3 character never made their signature specialization choice.
 *
 * Two iconic options per class so the level-3 choice is real. Surfaced by
 * `subclassFeaturesForLevel` and applied in `performLevelUp`.
 */
import { ClassFeature } from '../../types/character';

export interface Subclass {
  id: string;
  classId: string;
  name: string;
  description: string;
  /** Features granted by this subclass, each with the level it's gained. */
  features: ClassFeature[];
}

const f = (id: string, name: string, description: string, levelAvailable = 3): ClassFeature => ({
  id,
  name,
  description,
  levelAvailable,
});

export const SUBCLASSES: Record<string, Subclass[]> = {
  fighter: [
    { id: 'champion', classId: 'fighter', name: 'Champion', description: 'A warrior whose training turns raw physical prowess into lethal precision.', features: [f('improved_critical', 'Improved Critical', 'Your weapon attacks score a critical hit on a roll of 19 or 20.'), f('remarkable_athlete', 'Remarkable Athlete', 'Add half your proficiency bonus to Strength, Dexterity, and Constitution checks that don\'t already use it.')] },
    { id: 'battle_master', classId: 'fighter', name: 'Battle Master', description: 'A student of martial technique who wields combat maneuvers fueled by superiority dice.', features: [f('combat_superiority', 'Combat Superiority', 'Learn maneuvers fueled by superiority dice (d8) to trip, disarm, or rally.'), f('student_of_war', 'Student of War', 'Gain proficiency with one artisan\'s tools of your choice.')] },
  ],
  barbarian: [
    { id: 'berserker', classId: 'barbarian', name: 'Path of the Berserker', description: 'Rage taken to its bloody extreme, a font of unbridled fury.', features: [f('frenzy', 'Frenzy', 'While raging, make a bonus-action melee attack each turn; suffer exhaustion when the rage ends.')] },
    { id: 'wild_heart', classId: 'barbarian', name: 'Path of the Wild Heart', description: 'A barbarian bonded to primal spirits of the natural world.', features: [f('rage_of_the_wilds', 'Rage of the Wilds', 'Channel an animal spirit while raging, gaining its boon (bear resilience, eagle speed, or wolf pack tactics).')] },
  ],
  bard: [
    { id: 'college_of_lore', classId: 'bard', name: 'College of Lore', description: 'A keeper of knowledge who turns wit into a weapon.', features: [f('cutting_words', 'Cutting Words', 'Use your reaction and a Bardic Inspiration die to subtract from an enemy\'s attack, check, or damage.'), f('bonus_proficiencies_lore', 'Bonus Proficiencies', 'Gain proficiency with three skills of your choice.')] },
    { id: 'college_of_valor', classId: 'bard', name: 'College of Valor', description: 'A skald whose songs inspire allies to feats of martial glory.', features: [f('combat_inspiration', 'Combat Inspiration', 'Allies can spend your Bardic Inspiration to boost damage or AC.'), f('valor_proficiencies', 'Martial Training', 'Gain proficiency with medium armor, shields, and martial weapons.')] },
  ],
  cleric: [
    { id: 'life_domain', classId: 'cleric', name: 'Life Domain', description: 'A cleric of healing and vitality, a bulwark against death.', features: [f('disciple_of_life', 'Disciple of Life', 'Your healing spells restore additional hit points equal to 2 + the spell\'s level.'), f('life_domain_spells', 'Domain Spells', 'Always have Bless, Cure Wounds, and other life spells prepared.')] },
    { id: 'light_domain', classId: 'cleric', name: 'Light Domain', description: 'A cleric who wields radiant fire against the dark.', features: [f('warding_flare', 'Warding Flare', 'Use your reaction to impose disadvantage on an attacker with a flash of light.'), f('light_domain_spells', 'Domain Spells', 'Always have Burning Hands, Faerie Fire, and other light spells prepared.')] },
  ],
  druid: [
    { id: 'circle_of_the_land', classId: 'druid', name: 'Circle of the Land', description: 'A druid drawing magic from a particular terrain.', features: [f('lands_aid', 'Land\'s Aid', 'Expend a Wild Shape use to heal an ally and damage a foe with surging nature.'), f('circle_spells_land', 'Circle Spells', 'Gain bonus prepared spells tied to your chosen land.')] },
    { id: 'circle_of_the_moon', classId: 'druid', name: 'Circle of the Moon', description: 'A shapeshifting druid who wades into battle in beast form.', features: [f('circle_forms', 'Circle Forms', 'Wild Shape into fiercer beasts and gain temporary hit points when you do.')] },
  ],
  ranger: [
    { id: 'hunter', classId: 'ranger', name: 'Hunter', description: 'A ranger specialized in slaying the monsters that threaten the wilds.', features: [f('hunters_prey', 'Hunter\'s Prey', 'Choose Colossus Slayer, Giant Killer, or Horde Breaker to punish your foes.')] },
    { id: 'beast_master', classId: 'ranger', name: 'Beast Master', description: 'A ranger who fights alongside a bonded animal companion.', features: [f('primal_companion', 'Primal Companion', 'Summon a loyal beast companion that acts on your turn and grows with you.')] },
  ],
  rogue: [
    { id: 'thief', classId: 'rogue', name: 'Thief', description: 'A nimble burglar and treasure-hunter.', features: [f('fast_hands', 'Fast Hands', 'Use your Cunning Action bonus action to Sleight of Hand, use thieves\' tools, or use an object.'), f('second_story_work', 'Second-Story Work', 'Climbing costs no extra movement, and you jump farther.')] },
    { id: 'assassin', classId: 'rogue', name: 'Assassin', description: 'A killer who strikes from the shadows with lethal surprise.', features: [f('assassinate', 'Assassinate', 'Advantage against foes who haven\'t acted; a hit against a surprised creature is a critical.'), f('assassins_tools', 'Assassin\'s Tools', 'Gain a disguise kit, poisoner\'s kit, and proficiency with them.')] },
  ],
  paladin: [
    { id: 'oath_of_devotion', classId: 'paladin', name: 'Oath of Devotion', description: 'A paladin bound to the ideals of justice and honor.', features: [f('sacred_weapon', 'Sacred Weapon (Channel Divinity)', 'Imbue your weapon with radiant power, adding your Charisma to attacks and shedding light.')] },
    { id: 'oath_of_vengeance', classId: 'paladin', name: 'Oath of Vengeance', description: 'A paladin sworn to punish those who commit grievous sins.', features: [f('vow_of_enmity', 'Vow of Enmity (Channel Divinity)', 'Gain advantage on attacks against a chosen foe for one minute.')] },
  ],
  monk: [
    { id: 'open_hand', classId: 'monk', name: 'Warrior of the Open Hand', description: 'A master of unarmed combat and the flowing of ki.', features: [f('open_hand_technique', 'Open Hand Technique', 'Your Flurry of Blows can knock prone, push, or deny reactions.')] },
    { id: 'shadow', classId: 'monk', name: 'Warrior of Shadow', description: 'A monk who wields the arts of stealth and darkness.', features: [f('shadow_arts', 'Shadow Arts', 'Spend Focus to cast Darkness, Darkvision, Pass without Trace, or Silence.')] },
  ],
  sorcerer: [
    { id: 'draconic', classId: 'sorcerer', name: 'Draconic Sorcery', description: 'A sorcerer whose magic springs from draconic blood.', features: [f('draconic_resilience', 'Draconic Resilience', 'Your hit point maximum increases and your unarmored AC becomes 10 + Dex + Cha.'), f('draconic_spells', 'Draconic Spells', 'Gain bonus prepared spells themed to dragons.')] },
    { id: 'wild_magic', classId: 'sorcerer', name: 'Wild Magic Sorcery', description: 'A sorcerer whose power crackles with chaotic unpredictability.', features: [f('wild_magic_surge', 'Wild Magic Surge', 'Your spells can trigger a roll on the Wild Magic table for unpredictable effects.'), f('tides_of_chaos', 'Tides of Chaos', 'Gain advantage on one roll, at the cost of a possible surge.')] },
  ],
  warlock: [
    { id: 'fiend', classId: 'warlock', name: 'Fiend Patron', description: 'A warlock who bargained with a lord of the Lower Planes.', features: [f('dark_ones_blessing', 'Dark One\'s Blessing', 'When you reduce an enemy to 0 HP, gain temporary hit points.')] },
    { id: 'archfey', classId: 'warlock', name: 'Archfey Patron', description: 'A warlock pledged to a lord or lady of the Feywild.', features: [f('steps_of_the_fey', 'Steps of the Fey', 'Cast Misty Step a number of times per long rest, with a soothing or taunting rider.')] },
  ],
  wizard: [
    { id: 'evocation', classId: 'wizard', name: 'Evoker (School of Evocation)', description: 'A wizard who sculpts raw elemental destruction.', features: [f('sculpt_spells', 'Sculpt Spells', 'Carve safe zones in your evocation spells so allies escape their effects.')] },
    { id: 'abjuration', classId: 'wizard', name: 'Abjurer (School of Abjuration)', description: 'A wizard specialized in protective and warding magic.', features: [f('arcane_ward', 'Arcane Ward', 'Casting abjuration spells creates a magical ward that absorbs damage for you.')] },
  ],
};

/** All subclass options for a class (empty if the class has none defined). */
export function subclassesForClass(classId: string): Subclass[] {
  return SUBCLASSES[classId] ?? [];
}

/** Look up a specific subclass by class + id. */
export function findSubclass(classId: string, subclassId: string | undefined): Subclass | undefined {
  if (!subclassId) return undefined;
  return (SUBCLASSES[classId] ?? []).find(s => s.id === subclassId);
}
