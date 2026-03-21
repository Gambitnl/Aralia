import { Feat } from '../../types';
import { SpellSchool } from '../../types/spells';

/**
 * ARCHITECTURAL CONTEXT:
 * This file serves as the 'Feats Repository' for Aralia. It is a static 
 * data structure used by the Character Creator and Level-Up systems to 
 * populate selection menus.
 *
 * Recent updates focus on 'Selectable Benefits'. Many feats (like Resilient 
 * or Skilled) now support multiple ability score or skill options rather 
 * than hardcoded values. This shift requires the consumer (UI) to handle 
 * nested selection logic which is flagged via 'selectableAbilityScores' 
 * or 'selectableSkillCount' properties.
 * 
 * @file src/data/feats/featsData.ts
 */
export const FEATS_DATA: Feat[] = [
  {
    id: 'ability_score_improvement',
    name: 'Ability Score Improvement',
    description: 'Pour focused training into a core attribute. Increase one ability score by 2, or two ability scores by 1, to a maximum of 20.',
    benefits: {
      abilityScoreIncrease: {},
    },
  },
  {
    id: 'actor',
    name: 'Actor',
    description: 'A master of disguise and vocal mimicry — you slip into another persona so completely that even those who know you hesitate. Gain Charisma +1, and Advantage on Deception and Performance checks made while impersonating someone.',
    prerequisites: { abilityScores: { Charisma: 13 } },
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
      skillProficiencies: ['deception', 'performance'],
    },
  },
  {
    id: 'alert',
    name: 'Alert',
    description: 'Hair-trigger instincts keep you one heartbeat ahead of every ambush. Add your Proficiency Bonus to Initiative rolls, and swap your Initiative result with a willing ally after rolling.',
    benefits: {
      initiativeBonusProficiency: true,
    },
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description: 'Your body is a finely tuned instrument. Gain Strength or Dexterity +1; your Climb Speed equals your walk speed, standing from Prone costs only 5 feet of movement, and any running jump requires just 5 feet of run-up.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'charger',
    name: 'Charger',
    description: 'You turn a full sprint into a devastating opening strike. Gain Strength or Dexterity +1; taking the Dash action grants +10 Speed that turn, and after moving 10 feet straight toward a target you deal 1d8 bonus damage on the next hit or shove them 10 feet.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'chef',
    name: 'Chef',
    description: 'From the campfire to the castle kitchen, your cooking sustains body and spirit. Gain Constitution or Wisdom +1, proficiency with Cook\'s Utensils, and the ability to prepare nourishing meals that grant temporary hit points after a short rest.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Constitution: 1, Wisdom: 1 },
      hpMaxIncreasePerLevel: 1,
    },
  },
  {
    id: 'dungeon_delver',
    name: 'Dungeon Delver',
    description: 'Years beneath the earth have sharpened your senses and steadied your nerves. You gain Advantage on Perception and Investigation checks to spot hidden doors and traps, and Resistance to damage dealt by traps.',
    prerequisites: { minLevel: 4 },
    benefits: {
      resistance: ['traps'],
      skillProficiencies: ['investigation', 'perception'],
    },
  },
  {
    id: 'durable',
    name: 'Durable',
    description: 'Hardship has forged you into something that simply refuses to die. Gain Constitution +1; you have Advantage on Death Saving Throws, and can expend a Hit Die as a Bonus Action to recover hit points during a Short Rest.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
    },
  },
  {
    id: 'healer',
    name: 'Healer',
    description: 'Battlefield medicine is an art, and you have mastered it under the worst possible conditions. When you use a Healer\'s Kit to stabilise or tend a creature, they may immediately roll one of their Hit Dice — and may reroll any die showing a 1.',
    // 2024 PHB: Healer is an ORIGIN feat — no ASI, no skill proficiency. Healer's Kit mechanics
    // TODO(FEATURES): Implement Healer's Kit stabilise-and-roll-hit-die mechanic (see docs/FEATURES_TODO.md).
  },
  {
    id: 'lucky',
    name: 'Lucky',
    description: 'Fortune bends to your will at the moments that matter most. Gain Luck Points equal to your Proficiency Bonus after each Long Rest; spend one to gain Advantage on any d20 test, or force a re-roll when you are attacked.',
    benefits: {
      luckyPoints: true,
    },
  },
  {
    id: 'observant',
    name: 'Observant',
    description: 'Nothing escapes your notice — a glance across a crowded tavern tells you everything. Gain Intelligence or Wisdom +1; your passive Perception and passive Investigation each increase by 5, and you can read lips.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom'],
      skillProficiencies: ['investigation', 'insight'],
    },
  },
  // Updated 2025-12-11: Changed from hardcoded Constitution to selectable ability score
  // Player chooses one of six abilities; gains +1 to that ability AND proficiency in that saving throw
  // TODO(FEATURES): Implement UI for ability selection and logic to apply matching save proficiency (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  {
    id: 'resilient',
    name: 'Resilient',
    description: 'Where you once faltered, you now hold firm. Choose one ability score to increase by 1 and gain proficiency in saving throws using that ability — fortifying your greatest vulnerability.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
      savingThrowLinkedToAbility: true,
    },
  },
  // Updated 2025-12-11: Changed from hardcoded skills to selectable
  // TODO(FEATURES): Implement UI for selecting 3 skills from the full skill list (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  {
    id: 'skilled',
    name: 'Skilled',
    description: 'You have thrown yourself into learning with relentless focus. Gain proficiency in any three skills of your choice — a rare versatility most adventurers envy.',
    benefits: {
      skillProficiencies: [],
      selectableSkillCount: 3,
    },
  },
  {
    id: 'tough',
    name: 'Tough',
    description: 'You have survived things that would kill lesser warriors, and each scar only makes you harder to put down. Your Hit Point maximum increases by twice your current level, and by 2 for every level you gain afterward.',
    benefits: {
      hpMaxIncreasePerLevel: 2,
    },
  },
  {
    id: 'crafter',
    name: 'Crafter',
    description: 'Seasons spent at the forge, loom, or workbench have made you entirely self-sufficient. Gain Intelligence +1, proficiency with three Artisan\'s Tools, craft items in half the time, and purchase nonmagical equipment at a 20% discount.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1 },
    },
  },
  {
    id: 'magic_initiate',
    name: 'Magic Initiate',
    description: 'A brush with the arcane has opened a door you can never fully close. Choose a class list and learn two cantrips and one 1st-level spell from it — the leveled spell can be cast once per Long Rest without expending a slot.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        selectableSpellSource: ['cleric', 'druid', 'wizard'],
        spellChoices: [
          { count: 2, level: 0, description: 'Choose 2 cantrips from your selected class' },
          { count: 1, level: 1, description: 'Choose 1 first-level spell from your selected class' },
        ],
      },
    },
  },
  {
    id: 'musician',
    name: 'Musician',
    description: 'Music is your language for inspiring courage. Gain Charisma +1 and proficiency with three Musical Instruments; after a Long Rest, a performance of your choosing grants Bardic Inspiration to nearby allies.',
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
    },
  },
  {
    id: 'savage_attacker',
    name: 'Savage Attacker',
    description: 'You commit to every swing with reckless ferocity, refusing to accept a weak result. Once per turn when you hit with a weapon, roll the damage dice twice and use either result.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  // Updated 2025-12-11: Changed from giving both STR+1 and CON+1 to selecting one
  // TODO(FEATURES): Implement UI for ability selection; also needs improvised weapon and unarmed strike mechanics (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  {
    id: 'tavern_brawler',
    name: 'Tavern Brawler',
    description: 'A broken bottle, a bar stool, a headbutt — anything becomes a weapon in your hands. Gain Strength or Constitution +1, proficiency with Improvised Weapons, improved Unarmed Strikes (1d4 + Strength), and after landing a hit you can shove the target 5 feet.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Constitution'],
    },
  },
  {
    id: 'crossbow_expert',
    name: 'Crossbow Expert',
    description: 'You load, aim, and fire in a single fluid motion. Gain Dexterity +1; ignore the Loading property of crossbows, fire without Disadvantage while adjacent to enemies, and make a Bonus Action hand-crossbow attack after attacking with a one-handed weapon.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'defensive_duelist',
    name: 'Defensive Duelist',
    description: 'The blade is your shield. Gain Dexterity +1; when an enemy strikes at you while you hold a finesse weapon you\'re proficient with, spend your Reaction to add your Proficiency Bonus to your AC against that hit.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'dual_wielder',
    name: 'Dual Wielder',
    description: 'Two blades move as one under your hands. Gain Dexterity +1; gain +1 AC while dual-wielding, draw or stow two weapons simultaneously, and wield any one-handed melee weapons — not just Light ones — in each hand.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  // Updated 2025-12-11: Added selectableDamageTypes for the elemental choice
  // TODO(FEATURES): Implement UI for damage type selection and combat logic for ignoring resistance / treating 1s as 2s (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  {
    id: 'elemental_adept',
    name: 'Elemental Adept',
    description: 'You have bent a primal force entirely to your will. Gain a spellcasting ability +1; choose Acid, Cold, Fire, Lightning, or Thunder — your spells ignore Resistance to that type, and damage dice showing 1 count as 2.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      selectableDamageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
    },
  },
  {
    id: 'fey_touched',
    name: 'Fey-Touched',
    description: 'Something from the border of worlds has left its mark on you — a flicker of glamour in the blood. Gain a mental ability +1; learn Misty Step and one 1st-level Divination or Enchantment spell, each usable once per Long Rest without a slot.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        grantedSpells: [
          { spellId: 'misty-step', castingMethod: 'once_per_long_rest' },
        ],
        spellChoices: [
          { count: 1, level: 1, schools: [SpellSchool.Divination, SpellSchool.Enchantment], description: 'Choose 1 Divination or Enchantment spell' },
        ],
      },
    },
  },
  {
    id: 'grappler',
    name: 'Grappler',
    description: 'Your grip is a cage your enemies cannot escape. Gain Strength or Dexterity +1; your Unarmed Strikes can simultaneously initiate a Grapple on a hit, and you have Advantage on attacks against any creature you are currently grappling.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'great_weapon_master',
    name: 'Great Weapon Master',
    description: 'Every critical strike and every fallen foe feeds your momentum. Gain Strength +1; deal bonus damage equal to your Proficiency Bonus on every hit with a Heavy weapon, and when you roll a critical hit or reduce a creature to 0 HP, make one extra melee attack as a Bonus Action.',
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
      heavyWeaponProficiencyBonus: true,
    },
  },
  {
    id: 'heavily_armored',
    name: 'Heavily Armored',
    description: 'You have trained to bear the full weight of war — plate, mail, and all. Gain proficiency with Heavy Armor and increase Strength or Constitution by 1.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Constitution'],
    },
  },
  {
    id: 'heavy_armor_master',
    name: 'Heavy Armor Master',
    description: 'Iron plates become a second skin, turning aside blows that would fell a lesser warrior. Gain Strength +1; while wearing Heavy Armor, reduce nonmagical Bludgeoning, Piercing, and Slashing damage you take by an amount equal to your Proficiency Bonus.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
      damageReductionProficiency: true,
    },
  },
  {
    id: 'inspiring_leader',
    name: 'Inspiring Leader',
    description: 'Your words kindle something fierce in the hearts of those who follow you. Gain Charisma +1; spend 10 minutes to grant up to 6 creatures temporary hit points equal to your Charisma modifier + your Proficiency Bonus.',
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
    },
  },
  {
    id: 'keen_mind',
    name: 'Keen Mind',
    description: 'Your mind is a trap that never forgets. Gain Intelligence +1; you always know which way is north and how many hours remain until dawn or dusk, and can perfectly recall anything you have seen or heard within the past month.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1 },
    },
  },
  {
    id: 'lightly_armored',
    name: 'Lightly Armored',
    description: 'Even the lightest armor demands practice to wear well, and you have done the work. Gain Dexterity +1 and proficiency with Light Armor.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'mage_slayer',
    name: 'Mage Slayer',
    description: 'You have learned to read the telltale cadence of a spell being cast — and to close the gap before the incantation completes. Gain Strength or Dexterity +1; when you damage a concentrating creature it has Disadvantage on its save, and once per Short Rest you can auto-succeed on one Intelligence, Wisdom, or Charisma saving throw.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'martial_weapon_training',
    name: 'Martial Weapon Training',
    description: 'Weeks at the training yard have broadened your weapon repertoire far beyond what most combatants ever master. Gain Strength +1 and Dexterity +1, and proficiency with all Martial Weapons.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'medium_armor_master',
    name: 'Medium Armor Master',
    description: 'You wear medium armor like a second skin, squeezing every point of protection out of every strap and buckle. Gain Dexterity +1; add up to 3 (instead of 2) of your Dexterity modifier to AC while in medium armor, and suffer no Stealth Disadvantage from it.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'moderately_armored',
    name: 'Moderately Armored',
    description: 'The transition from light to medium armor is a milestone of martial training — you have crossed it. Gain Strength or Dexterity +1 and proficiency with Medium Armor and Shields.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'mounted_combatant',
    name: 'Mounted Combatant',
    description: 'From horseback you are a force of nature — elevated, fast, and terrifying. Gain Strength or Dexterity +1; Advantage on melee attacks against unmounted smaller creatures, redirect attacks targeting your mount to yourself, and your mount gains Evasion on Dexterity saving throws.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'piercer',
    name: 'Piercer',
    description: 'You drive the point home with uncanny precision, finding the gap between scales and armour alike. Gain Strength or Dexterity +1; once per turn reroll one piercing damage die and use the higher result, and on a critical hit roll one additional damage die.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'poisoner',
    name: 'Poisoner',
    description: 'You handle deadly substances with a practitioner\'s calm. Gain Dexterity +1 and Intelligence +1; your crafted poisons bypass Poison Resistance, and coating a blade or piece of ammunition takes only a Bonus Action.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1, Intelligence: 1 },
    },
  },
  {
    id: 'polearm_master',
    name: 'Polearm Master',
    description: 'Every inch of your weapon is a threat. Gain Strength or Dexterity +1; make a Bonus Action butt-end strike after attacking with a Glaive, Halberd, Quarterstaff, or Spear, and trigger opportunity attacks the moment an enemy enters your reach.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'ritual_caster',
    name: 'Ritual Caster',
    description: 'Forbidden formulae fill your journals — power without the price of a slot. Gain Intelligence or Wisdom +1; learn ritual spells from a chosen class list, scribe new ritual spells you discover, and cast them as extended rituals.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom'],
    },
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    description: 'You are the wall nothing passes through. Gain Strength or Dexterity +1; opportunity attacks you make reduce the target\'s Speed to 0, enemies cannot Disengage past you, and foes who attack your allies draw an immediate opportunity attack from you.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'shadow_touched',
    name: 'Shadow-Touched',
    description: 'The dark between worlds has seeped into your blood, and shadows answer your call. Gain a mental ability +1; learn Invisibility and one 1st-level Illusion or Necromancy spell, each castable once per Long Rest without a slot.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        grantedSpells: [
          { spellId: 'invisibility', castingMethod: 'once_per_long_rest' },
        ],
        spellChoices: [
          { count: 1, level: 1, schools: [SpellSchool.Illusion, SpellSchool.Necromancy], description: 'Choose 1 Illusion or Necromancy spell' },
        ],
      },
    },
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Distance and cover mean nothing to a trained eye. Gain Dexterity +1; your ranged attacks ignore half and three-quarters cover.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'shield_master',
    name: 'Shield Master',
    description: 'Your shield is as much a weapon as the blade in your other hand. Gain Strength or Dexterity +1; add your shield\'s bonus to Dex saves that target only you, use your Reaction to take no damage on a successful Dex save versus a half-damage effect, and shove a foe as a Bonus Action after attacking.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'skill_expert',
    name: 'Skill Expert',
    description: 'A lifetime of obsessive practice has sharpened one talent to a razored edge. Gain +1 to any ability score, proficiency in one skill of your choice, and Expertise — double proficiency — in one skill you are already proficient with.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
      skillProficiencies: ['any'],
    },
  },
  {
    id: 'skulker',
    name: 'Skulker',
    description: 'You are a shadow given purpose — patient, invisible, lethal. Gain Dexterity +1 and Blindsight 10 feet; lightly obscured terrain does not reveal you when hidden, and missing with a ranged attack does not give away your position.',
    prerequisites: { abilityScores: { Dexterity: 13 } },
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  // Updated 2025-12-11: Changed from giving both STR+1 and DEX+1 to selecting one
  // Combat mechanics implemented 2026-01-05: Speed reduction (once per turn) and crit disadvantage via ActiveEffect
  // TODO(FEATURES): Implement UI for ability selection (STR or DEX) during feat selection.
  {
    id: 'slasher',
    name: 'Slasher',
    description: 'A clean slash leaves them stumbling, bleeding, and afraid. Gain Strength or Dexterity +1; once per turn reduce a struck creature\'s Speed by 10 feet, and on a critical hit they have Disadvantage on attacks until your next turn.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },
  {
    id: 'speedy',
    name: 'Speedy',
    description: 'Your legs carry you faster than most people think possible, and nothing on the ground slows you when you\'re running. Gain Dexterity +1, +10 feet Speed, and nonmagical difficult terrain doesn\'t slow you when you take the Dash action.',
    benefits: {
      abilityScoreIncrease: { Dexterity: 1 },
      speedIncrease: 10,
    },
  },
  {
    id: 'spell_sniper',
    name: 'Spell Sniper',
    description: 'You thread spells through arrow-slits and around pillars that lesser casters never attempt. Gain a spellcasting ability +1; double the range of spell attacks, ignore half and three-quarters cover, learn one attack cantrip, and your spell attacks score a critical hit on a 19 or 20.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        spellChoices: [
          { count: 1, level: 0, requiresAttack: true, description: 'Choose 1 cantrip that requires an attack roll' },
        ],
      },
    },
  },
  {
    id: 'telekinetic',
    name: 'Telekinetic',
    description: 'Your will extends outward, nudging the world with invisible fingers no one can trace. Gain a mental ability +1; cast Mage Hand at will (60 ft range, invisible), and as a Bonus Action push or pull a creature 5 feet on a failed Strength save.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        grantedSpells: [
          { spellId: 'mage-hand', castingMethod: 'at_will', specialNotes: 'Range 60 ft, invisible hand' },
        ],
      },
    },
  },
  {
    id: 'telepathic',
    name: 'Telepathic',
    description: 'Your thoughts bleed outward, touching minds without a spoken word. Gain a mental ability +1; cast Detect Thoughts once per Long Rest without a slot, and communicate telepathically with any creature you can see within 60 feet.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
      spellBenefits: {
        grantedSpells: [
          { spellId: 'detect-thoughts', castingMethod: 'once_per_long_rest' },
        ],
      },
    },
  },
  {
    id: 'war_caster',
    name: 'War Caster',
    description: 'Battle is your crucible — the incantation holds even when the blade falls. Gain Intelligence, Wisdom, or Charisma +1; Advantage on Concentration saving throws, perform somatic components with weapons or a shield in hand, and cast a spell instead of making an opportunity attack.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    },
  },
  {
    id: 'weapon_master',
    name: 'Weapon Master',
    description: 'You have drilled obsessively with weapons most soldiers never touch, expanding your martial repertoire far beyond your training. Gain Strength or Dexterity +1 and proficiency with four weapons of your choice.',
    benefits: {
      abilityScoreIncrease: {},
      selectableAbilityScores: ['Strength', 'Dexterity'],
    },
  },

  // === FIGHTING STYLE FEATS ===
  {
    id: 'archery_style',
    name: 'Archery Fighting Style',
    description: 'Countless hours at the range have perfected your draw, sight picture, and release. You gain a +2 bonus to attack rolls made with ranged weapons.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'defense_style',
    name: 'Defense Fighting Style',
    description: 'You know how to angle each piece of armor to deflect the blow and redirect the force. While wearing armor, you gain a +1 bonus to AC.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'dueling_style',
    name: 'Dueling Fighting Style',
    description: 'A single blade, perfectly controlled, is all you need. When you wield a one-handed melee weapon and no other weapons, gain +2 to damage rolls with that weapon.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'great_weapon_fighting_style',
    name: 'Great Weapon Fighting Style',
    description: 'You let the weight and momentum flow through you, never accepting a weak swing. When you attack with a two-handed or versatile melee weapon, reroll any damage dice showing 1 — once per die.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'two_weapon_fighting_style',
    name: 'Two-Weapon Fighting Style',
    description: 'You have trained your off hand to be every bit as lethal as your primary — no wasted motion, no wasted hit. Add your ability modifier to the damage of your off-hand attack.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'protection_style',
    name: 'Protection Fighting Style',
    description: 'Your shield is a promise to those who stand beside you. While wielding a shield, use your Reaction to impose Disadvantage on an attack roll against a nearby ally you can see.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'interception_style',
    name: 'Interception Fighting Style',
    description: 'You throw yourself between friend and blade without hesitation. While wielding a weapon or shield, use your Reaction to reduce a nearby ally\'s incoming damage by 1d10 + your Proficiency Bonus.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'unarmed_fighting_style',
    name: 'Unarmed Fighting Style',
    description: 'Your body is a weapon, refined through brutal conditioning until fists hit harder than some swords. Unarmed strikes deal 1d8 damage (1d6 if holding anything); grappled foes take 1d4 bludgeoning at the start of your turn.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'blind_fighting_style',
    name: 'Blind Fighting Style',
    description: 'You have trained in total darkness until darkness itself surrenders its secrets to you. Gain Blindsight 10 feet — perceiving everything within range regardless of light or invisibility.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
  {
    id: 'thrown_weapon_fighting_style',
    name: 'Thrown Weapon Fighting Style',
    description: 'Every hurled blade or axe is an extension of your arm — drawn and thrown in one seamless motion. Draw thrown weapons as part of the throw, and deal +2 damage on ranged attacks with thrown weapons.',
    prerequisites: {
      requiresFightingStyle: true,
    },
  },
];
