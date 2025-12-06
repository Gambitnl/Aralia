import { Feat } from '../../types';

/**
 * Central feat catalogue. These entries intentionally focus on the
 * mechanical pieces the character builder and level-up systems need
 * (prerequisites + numerical benefits) rather than full rule text.
 */
export const FEATS_DATA: Feat[] = [
  {
    id: 'ability_score_improvement',
    name: 'Ability Score Improvement',
    description: 'Increase one ability score by 2, or two ability scores by 1 (to a max of 20).',
    benefits: {
      abilityScoreIncrease: {},
    },
  },
  {
    id: 'actor',
    name: 'Actor',
    description: 'Gain advantage on Performance and Deception checks made to adopt a persona and learn mimicry.',
    prerequisites: { abilityScores: { Charisma: 13 } },
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
      skillProficiencies: ['deception', 'performance'],
    },
  },
  {
    id: 'alert',
    name: 'Alert',
    description: 'You stay wary at all times, improving your initiative and awareness.',
    benefits: {
      initiativeBonus: 5,
    },
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description: 'Conditioning improves your balance, agility, and stamina.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'charger',
    name: 'Charger',
    description: 'Harness your momentum to hit harder when dashing into melee.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'chef',
    name: 'Chef',
    description: 'Culinary training grants you hearty meals and better stamina.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Constitution: 1, Wisdom: 1 },
      hpMaxIncreasePerLevel: 1,
    },
  },
  {
    id: 'dungeon_delver',
    name: 'Dungeon Delver',
    description: 'Heightened senses help you avoid traps and hidden dangers underground.',
    prerequisites: { minLevel: 4 },
    benefits: {
      resistance: ['traps'],
      skillProficiencies: ['investigation', 'perception'],
    },
  },
  {
    id: 'durable',
    name: 'Durable',
    description: 'Hardy and resilient, you recover more health when resting.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
      hpMaxIncreasePerLevel: 1,
    },
  },
  {
    id: 'healer',
    name: 'Healer',
    description: 'Battlefield medicine keeps your allies in the fight.',
    benefits: {
      abilityScoreIncrease: { Wisdom: 1 },
      skillProficiencies: ['medicine'],
    },
  },
  {
    id: 'lucky',
    name: 'Lucky',
    description: 'Fortune favors you when the stakes are high.',
  },
  {
    id: 'mobile',
    name: 'Mobile',
    description: 'Exceptional speed and footwork let you dart around the battlefield.',
    benefits: {
      speedIncrease: 10,
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'observant',
    name: 'Observant',
    description: 'Attentive eyes and ears sharpen your awareness of your surroundings.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1, Wisdom: 1 },
      skillProficiencies: ['investigation', 'insight'],
    },
  },
  {
    id: 'resilient',
    name: 'Resilient',
    description: 'Bolster a saving throw of your choice.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
      savingThrowProficiencies: ['Constitution'],
    },
  },
  {
    id: 'skilled',
    name: 'Skilled',
    description: 'You gain proficiency in three skills of your choice.',
    benefits: {
      skillProficiencies: ['athletics', 'perception', 'insight'],
    },
  },
  {
    id: 'tough',
    name: 'Tough',
    description: 'Each time you gain this feat, your hit point maximum increases by twice your level.',
    benefits: {
      hpMaxIncreasePerLevel: 2,
    },
  },
  {
    id: 'crafter',
    name: 'Crafter',
    description:
      'Gain artisan tool proficiency, craft faster, and buy nonmagical equipment and tools at a discount.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1 },
    },
  },
  {
    id: 'magic_initiate',
    name: 'Magic Initiate',
    description:
      'Learn two cantrips and one 1st-level spell from a class list; cast the 1st-level spell once per long rest without a slot.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'musician',
    name: 'Musician',
    description:
      'Gain proficiency with three instruments; after a long rest grant allies inspiration via performance.',
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
    },
  },
  {
    id: 'savage_attacker',
    name: 'Savage Attacker',
    description:
      'Once per turn when you hit with a melee weapon, reroll the weapon’s damage dice and use the higher result.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'tavern_brawler',
    name: 'Tavern Brawler',
    description:
      'Increase Strength or Constitution, become proficient with improvised weapons, improve unarmed strikes, and can grapple as a bonus action after hitting.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Constitution: 1 },
    },
  },
  {
    id: 'crossbow_expert',
    name: 'Crossbow Expert',
    description:
      'Ignore the loading property of crossbows, no disadvantage in 5-foot range with ranged attacks, and make a bonus-action hand crossbow attack after attacking with a one-handed weapon.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'defensive_duelist',
    name: 'Defensive Duelist',
    description:
      'While wielding a finesse weapon you are proficient with, use your reaction to add your proficiency bonus to AC against one melee attack.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'dual_wielder',
    name: 'Dual Wielder',
    description:
      'Improve two-weapon fighting: +1 AC while dual wielding, draw/stow two weapons, and two-weapon fight with non-light one-handed melee weapons.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'elemental_adept',
    name: 'Elemental Adept',
    description:
      'Choose acid, cold, fire, lightning, or thunder; your spells ignore resistance to that damage and treat 1s on damage dice as 2s.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'fey_touched',
    name: 'Fey-Touched',
    description:
      'Increase mental ability, learn Misty Step and one 1st-level divination or enchantment spell; cast each once per long rest for free.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'grappler',
    name: 'Grappler',
    description:
      'Gain advantage on attack rolls against creatures you grapple and can restrain both yourself and the target by succeeding on another grapple check.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'great_weapon_master',
    name: 'Great Weapon Master',
    description:
      'On crit or dropping a creature to 0 HP, make one melee weapon attack as a bonus action; also take -5 to hit for +10 damage with heavy melee weapons.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'heavily_armored',
    name: 'Heavily Armored',
    description:
      'Gain proficiency with heavy armor and increase Strength or Constitution.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Constitution'],
    },
  },
  {
    id: 'heavy_armor_master',
    name: 'Heavy Armor Master',
    description:
      'Increase Strength; while in heavy armor reduce nonmagical bludgeoning, piercing, and slashing damage you take by 3.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
      resistance: ['physical_reduction'],
    },
  },
  {
    id: 'inspiring_leader',
    name: 'Inspiring Leader',
    description:
      'Spend 10 minutes to give temporary hit points to up to six creatures (including you) equal to your level + Charisma modifier.',
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
    },
  },
  {
    id: 'keen_mind',
    name: 'Keen Mind',
    description:
      'Increase Intelligence; always know which way is north, the number of hours left before sunrise/sunset, and accurately recall anything seen or heard within the past month.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1 },
    },
  },
  {
    id: 'lightly_armored',
    name: 'Lightly Armored',
    description: 'Gain proficiency with light armor and improve Dexterity.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'mage_slayer',
    name: 'Mage Slayer',
    description:
      'You excel against spellcasters: react to impose disadvantage on a creature’s concentration saves when you damage it, and you gain advantage on saves against spells cast by adjacent foes.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'martial_weapon_training',
    name: 'Martial Weapon Training',
    description: 'Gain proficiency with martial weapons and a modest accuracy boost from training.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'medium_armor_master',
    name: 'Medium Armor Master',
    description:
      'Increase Dexterity; while wearing medium armor you can add 3 Dex to AC instead of 2 and you no longer suffer disadvantage on Stealth from medium armor.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'moderately_armored',
    name: 'Moderately Armored',
    description:
      'Gain proficiency with medium armor and shields; increase Strength or Dexterity.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'mounted_combatant',
    name: 'Mounted Combatant',
    description:
      'Gain advantage on melee attacks against unmounted smaller creatures, force attacks to target you instead of your mount, and give your mount evasion on Dexterity saves.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'piercer',
    name: 'Piercer',
    description:
      'Increase Strength or Dexterity; reroll one damage die on piercing attacks once per turn and crits with piercing weapons roll one additional damage die.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'poisoner',
    name: 'Poisoner',
    description:
      'Craft potent poisons, ignore resistance to poison damage with your poisons, and apply poison as a bonus action.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1, Intelligence: 1 },
    },
  },
  {
    id: 'polearm_master',
    name: 'Polearm Master',
    description:
      'While wielding a glaive, halberd, quarterstaff, or spear you can make a bonus-action butt-end attack and make opportunity attacks when creatures enter your reach.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'ritual_caster',
    name: 'Ritual Caster',
    description:
      'Learn ritual spells from a chosen class list, can copy new ritual spells you find, and cast them as rituals.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1, Wisdom: 1 },
    },
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    description:
      'Halt foes with opportunity attacks that reduce speed to 0, react even on Disengage, and impose disadvantage on attacks against targets other than you.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'shadow_touched',
    name: 'Shadow-Touched',
    description:
      'Increase a mental stat; learn Invisibility and one 1st-level illusion or necromancy spell; each can be cast once per long rest for free.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description:
      'Attacking at long range doesn’t impose disadvantage, ranged attacks ignore half and three-quarters cover, and you can take -5 to hit for +10 damage with ranged weapon attacks.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'shield_master',
    name: 'Shield Master',
    description:
      'Add shield bonus to Dex saves against effects targeting only you, use reaction to take no damage on successful Dex save vs half-damage effects, and shove as a bonus action after attacking.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'skill_expert',
    name: 'Skill Expert',
    description:
      'Increase one ability, gain proficiency in one skill, and expertise in one skill you’re proficient in.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
      skillProficiencies: ['any'],
    },
  },
  {
    id: 'skulker',
    name: 'Skulker',
    description:
      'You excel at hiding: lightly obscured doesn’t reveal you, missed ranged attacks don’t reveal you, and you can see dim light as bright for Perception to find creatures.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'slasher',
    name: 'Slasher',
    description:
      'Increase Strength or Dexterity; once per turn reduce a creature’s speed by 10 when you deal slashing damage; on a crit, the target has disadvantage on attacks until your next turn.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'speedy',
    name: 'Speedy',
    description:
      'Increase Dexterity; your speed increases and difficult terrain from nonmagical ground doesn’t slow you when you Dash.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
      speedIncrease: 10,
    },
  },
  {
    id: 'spell_sniper',
    name: 'Spell Sniper',
    description:
      'Double the range of spell attacks, ignore half and three-quarters cover with spell attacks, learn one attack cantrip, and your spell attacks crit on 19–20.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'telekinetic',
    name: 'Telekinetic',
    description:
      'Increase mental stat; gain Mage Hand with boosted range and bonus-action shove 5 feet on a failed Strength save.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'telepathic',
    name: 'Telepathic',
    description:
      'Increase mental stat; gain Detect Thoughts once per long rest and can communicate telepathically with nearby creatures.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'war_caster',
    name: 'War Caster',
    description:
      'Advantage on concentration saves, can perform somatic components with weapons/shields in hand, and can cast a spell in place of an opportunity attack.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
    },
  },
  {
    id: 'weapon_master',
    name: 'Weapon Master',
    description:
      'Gain proficiency with four weapons of your choice and increase Strength or Dexterity.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'archery_style',
    name: 'Archery Fighting Style',
    description:
      'You gain a +2 bonus to attack rolls you make with ranged weapons.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'defense_style',
    name: 'Defense Fighting Style',
    description: 'While you are wearing armor, you gain a +1 bonus to AC.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'dueling_style',
    name: 'Dueling Fighting Style',
    description:
      'When wielding a melee weapon in one hand and no other weapons, gain +2 damage on attacks with that weapon.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'great_weapon_fighting_style',
    name: 'Great Weapon Fighting Style',
    description:
      'When wielding a two-handed or versatile melee weapon, you can reroll 1s on damage dice (once per die).',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'two_weapon_fighting_style',
    name: 'Two-Weapon Fighting Style',
    description:
      'When you engage in two-weapon fighting, add your ability modifier to the damage of the off-hand attack.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'protection_style',
    name: 'Protection Fighting Style',
    description:
      'While wielding a shield, you can use your reaction to impose disadvantage on an attack against an adjacent ally.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'interception_style',
    name: 'Interception Fighting Style',
    description:
      'While wielding a shield or simple/martial weapon, use your reaction to reduce damage to a nearby ally by 1d10 + proficiency bonus.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'unarmed_fighting_style',
    name: 'Unarmed Fighting Style',
    description:
      'Your unarmed strikes deal 1d8 damage when not wielding weapons or a shield; 1d6 otherwise; and grapples deal extra damage.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'blind_fighting_style',
    name: 'Blind Fighting Style',
    description:
      'You have blindsight with a range of 10 feet, allowing you to see anything not behind total cover in that radius.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'thrown_weapon_fighting_style',
    name: 'Thrown Weapon Fighting Style',
    description:
      'You can draw thrown weapons as part of the attack and gain +2 damage on ranged attacks with thrown weapons.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
];
