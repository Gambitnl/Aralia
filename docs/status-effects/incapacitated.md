# Incapacitated Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 15 | `'Incapacitated': '🤕',` |

### `src/data/naval/crewTraits.ts`

| Line | Snippet |
|---|---|
| 30 | `'Drunkard': { effect: 'May be incapacitated', skillBonus: { 'Constitution': 2, 'Dexterity': -2 } },` |

### `src/data/races/air_genasi.ts`

| Line | Snippet |
|---|---|
| 22 | `'Unending Breath: You can hold your breath indefinitely while you are not Incapacitated.',` |

### `src/data/races/wildhunt_shifter.ts`

| Line | Snippet |
|---|---|
| 15 | `'Mark the Scent: While shifted, you have advantage on Wisdom checks, and no creature within 30 feet of you can make an attack roll with advantage agai...` |

### `src/systems/combat/reactions/OpportunityAttackSystem.ts`

| Line | Snippet |
|---|---|
| 59 | `// Check if attacker can physically take a reaction (Alive, Conscious, Not Incapacitated/Stunned/Paralyzed)` |

### `src/systems/crafting/creatureHarvestSystem.ts`

| Line | Snippet |
|---|---|
| 22 | `* Creature must be Dead or Incapacitated for most harvests.` |

### `src/systems/rituals/RitualManager.ts`

| Line | Snippet |
|---|---|
| 69 | `{ type: 'incapacitated' },` |
| 146 | `if (eventType === 'condition' && (conditionName === 'Incapacitated' \|\| conditionName === 'Unconscious')) {` |
| 147 | `return { interrupted: true, ritualBroken: true, reason: 'Caster incapacitated' };` |

### `src/systems/spells/mechanics/ConcentrationTracker.ts`

| Line | Snippet |
|---|---|
| 10 | `* - Broken by: taking damage, casting another concentration spell, being incapacitated, dying` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 15 | `Incapacitated = "Incapacitated",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 15 | `Incapacitated = 'Incapacitated',` |
| 93 | `"Ends if grappler is incapacitated or moved out of reach",` |
| 96 | `[ConditionType.Incapacitated]: {` |
| 116 | `"Incapacitated (no actions/reactions)",` |
| 127 | `"Incapacitated (no actions/reactions)",` |
| 167 | `"Incapacitated (no actions/reactions)",` |
| 178 | `"Incapacitated (no actions/reactions)",` |

### `src/types/ritual.d.ts`

| Line | Snippet |
|---|---|
| 49 | `type: 'damage' \| 'movement' \| 'silence' \| 'incapacitated' \| 'action';` |

### `src/types/ritual.ts`

| Line | Snippet |
|---|---|
| 78 | `type: 'damage' \| 'movement' \| 'silence' \| 'incapacitated' \| 'action';` |

### `src/types/rituals.d.ts`

| Line | Snippet |
|---|---|
| 61 | `type: 'damage' \| 'movement' \| 'silence' \| 'incapacitated' \| 'action' \| 'noise' \| 'distraction';` |

### `src/types/rituals.ts`

| Line | Snippet |
|---|---|
| 85 | `type: 'damage' \| 'movement' \| 'silence' \| 'incapacitated' \| 'action' \| 'noise' \| 'distraction';` |

### `src/types/spells.d.ts`

| Line | Snippet |
|---|---|
| 282 | `export type ConditionName = "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened" \| "Grappled" \| "Incapacitated" \| "Invisible" \| "P...` |

### `src/types/spells.ts`

| Line | Snippet |
|---|---|
| 457 | `\| "Grappled" \| "Incapacitated" \| "Invisible" \| "Paralyzed" \| "Petrified"` |

### `src/types/visuals.ts`

| Line | Snippet |
|---|---|
| 465 | `incapacitated: { id: 'incapacitated', label: 'Incapacitated', icon: '🤕', color: '#DC2626', description: 'Can’t take actions or reactions.' }, // red-...` |
| 467 | `paralyzed: { id: 'paralyzed', label: 'Paralyzed', icon: '⚡', color: '#FBBF24', description: 'Incapacitated and can’t move or speak. Attacks against th...` |
| 472 | `stunned: { id: 'stunned', label: 'Stunned', icon: '💫', color: '#FCD34D', description: 'Incapacitated, can’t move, and can speak only falteringly.' },...` |
| 473 | `unconscious: { id: 'unconscious', label: 'Unconscious', icon: '💤', color: '#1F2937', description: 'Incapacitated, can’t move or speak, and is unaware...` |

### `src/utils/combat/combatUtils.ts`

| Line | Snippet |
|---|---|
| 73 | `* - Evaluates incapacitating conditions (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious)` |
| 93 | `// 3. Must not be incapacitated` |
| 94 | `// Conditions that prevent reactions: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious` |
| 95 | `// Note: Sleep (Unconscious) and Hypnotic Pattern (Incapacitated) are covered here.` |
| 96 | `const incapacitatedConditions: string[] = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 186 | `\| 'incapacitated'` |

### `docs/spells/reference/level-1/tashas-hideous-laughter.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Incapacitated, Prone` |
| 34 | `- **Description**: A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter i...` |

### `docs/spells/reference/level-2/enhance-ability.md`

| Line | Snippet |
|---|---|
| 33 | `- **Description**: You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect un...` |

### `docs/spells/reference/level-2/enthrall.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You weave a distracting string of words, causing creatures of your choice that you can see within range and that can hear you to ma...` |

### `docs/spells/reference/level-3/feign-death.md`

| Line | Snippet |
|---|---|
| 31 | `- **Conditions Applied**: Blinded, Incapacitated` |
| 33 | `- **Description**: You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the duration, the target ...` |

### `docs/spells/reference/level-3/gaseous-form.md`

| Line | Snippet |
|---|---|
| 33 | `- **Description**: You transform a willing creature you touch, along with everything it's wearing and carrying, into a misty cloud for the duration. T...` |

### `docs/spells/reference/level-3/haste.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Incapacitated` |

### `docs/spells/reference/level-3/hypnotic-pattern.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Charmed, Incapacitated` |
| 36 | `- **Description**: You create a twisting pattern of colors that weaves through the air inside a 30-foot Cube within range. The pattern appears for a m...` |

### `docs/spells/reference/level-4/banishment.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Incapacitated, Banished` |
| 34 | `- **Description**: One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for th...` |

### `docs/spells/reference/level-5/contact-other-plane.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from another plane. Contacting t...` |

### `docs/spells/reference/level-5/dream.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You target a creature you know on the same plane of existence. You or a willing creature you touch enters a trance state to act as ...` |

### `docs/spells/reference/level-5/modify-memory.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fight...` |

### `docs/spells/reference/level-6/wind-walk.md`

| Line | Snippet |
|---|---|
| 34 | `- **Description**: You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. W...` |

### `docs/spells/reference/level-7/symbol.md`

| Line | Snippet |
|---|---|
| 44 | `**Pain.** Each target must succeed on a Constitution saving throw or have the Incapacitated condition for 1 minute.` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

### `docs/tasks/spell-system-overhaul/LEVEL-1-BATCHES.md`

| Line | Snippet |
|---|---|
| 61 | `- Notes: Sleep HP-pool slumber scaling; Speak with Animals (ritual) simple communication; Tasha's Caustic Brew line acid ongoing until washed, Dex sav...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/artificer_infusions.json`

| Line | Snippet |
|---|---|
| 18 | `"markdown": "# Artificer Infusions\r\nArtificer infusions are extraordinary processes that rapidly turn a nonmagical object into a magic item. The des...` |

### `public/data/glossary/entries/classes/artificer_subclasses/battle_smith.json`

| Line | Snippet |
|---|---|
| 22 | `"markdown": "# Battle Smith\r\nArmies require protection, and someone has to put things back together if defenses fail. A combination of protector and...` |

### `public/data/glossary/entries/classes/barbarian.json`

| Line | Snippet |
|---|---|
| 27 | `"markdown": "# Barbarian\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-...` |

### `public/data/glossary/entries/classes/bard_subclasses/college_of_dance.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# College of Dance\r\n\r\n**Move in Harmony with the Cosmos**\r\n\r\nBards of the College of Dance know that the Words of Creation can't ...` |

### `public/data/glossary/entries/classes/bard_subclasses/college_of_glamour.json`

| Line | Snippet |
|---|---|
| 25 | `"markdown": "# College of Glamour\r\n\r\n**Weave Beguiling Fey Magic**\r\n\r\nThe College of Glamour traces its origins to the beguiling magic of the ...` |

### `public/data/glossary/entries/classes/cleric.json`

| Line | Snippet |
|---|---|
| 32 | `"markdown": "# Cleric\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg ...` |

### `public/data/glossary/entries/classes/cleric_subclasses/trickery_domain.json`

| Line | Snippet |
|---|---|
| 24 | `"markdown": "# Trickery Domain\r\n\r\n**Make Mischief and Challenge Authority**\r\n\r\nThe Trickery Domain offers magic of deception, illusion, and st...` |

### `public/data/glossary/entries/classes/cleric_subclasses/war_domain.json`

| Line | Snippet |
|---|---|
| 25 | `"markdown": "# War Domain\r\n\r\n**Inspire Valor and Smite Foes**\r\n\r\nWar has many manifestations. It can make heroes of ordinary people. It can be...` |

### `public/data/glossary/entries/classes/druid.json`

| Line | Snippet |
|---|---|
| 33 | `"markdown": "# Druid\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg s...` |

### `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_land.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Circle of the Land\r\n\r\n**Celebrate Connection to the Natural World**\r\n\r\nThe Circle of the Land comprises mystics and sages who s...` |

### `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_sea.json`

| Line | Snippet |
|---|---|
| 24 | `"markdown": "# Circle of the Sea\r\n\r\n**Become One with Tides and Storms**\r\n\r\nDruids of the Circle of the Sea draw on the tempestuous forces of ...` |

### `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_stars.json`

| Line | Snippet |
|---|---|
| 24 | `"markdown": "# Circle of the Stars\r\n\r\n**Harness Secrets Hidden in Constellations**\r\n\r\nThe Circle of the Stars has tracked heavenly patterns si...` |

### `public/data/glossary/entries/classes/fighter_subclasses/battle_master.json`

| Line | Snippet |
|---|---|
| 18 | `"markdown": "# Battle Master\r\n\r\n**Master Sophisticated Battle Maneuvers**\r\n\r\nBattle Masters are students of the art of battle, learning martia...` |

### `public/data/glossary/entries/classes/fighter_subclasses/eldritch_knight.json`

| Line | Snippet |
|---|---|
| 20 | `"markdown": "# Eldritch Knight\r\n\r\n**Support Combat Skills with Arcane Magic**\r\n\r\nEldritch Knights combine the martial mastery common to all Fi...` |

### `public/data/glossary/entries/classes/fighter_subclasses/psi_warrior.json`

| Line | Snippet |
|---|---|
| 19 | `"markdown": "# Psi Warrior\r\n\r\n**Augment Physical Might with Psionic Power**\r\n\r\nPsi Warriors awaken the power of their minds to augment their p...` |

### `public/data/glossary/entries/classes/monk.json`

| Line | Snippet |
|---|---|
| 32 | `"markdown": "# Monk\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg sh...` |

### `public/data/glossary/entries/classes/monk_subclasses/warrior_of_shadow.json`

| Line | Snippet |
|---|---|
| 24 | `"markdown": "# Warrior of Shadow\r\n\r\n**Harness Shadow Power for Stealth and Subterfuge**\r\n\r\nWarriors of Shadow practice stealth and subterfuge,...` |

### `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_elements.json`

| Line | Snippet |
|---|---|
| 24 | `"markdown": "# Warrior of the Elements\r\n\r\n**Wield Strikes and Bursts of Elemental Power**\r\n\r\nWarriors of the Elements tap into the power of th...` |

### `public/data/glossary/entries/classes/paladin.json`

| Line | Snippet |
|---|---|
| 29 | `"markdown": "# Paladin\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg...` |

### `public/data/glossary/entries/classes/ranger_subclasses/beast_master.json`

| Line | Snippet |
|---|---|
| 19 | `"markdown": "# Beast Master\r\n\r\n**Bond with a Primal Beast**\r\n\r\nA Beast Master forms a mystical bond with a special animal, drawing on primal m...` |

### `public/data/glossary/entries/classes/rogue.json`

| Line | Snippet |
|---|---|
| 30 | `"markdown": "# Rogue\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg s...` |

### `public/data/glossary/entries/classes/sorcerer_subclasses/wild_magic_sorcery.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Wild Magic\r\n\r\n**Unleash Chaotic Magic**\r\n\r\nYour innate magic stems from the forces of chaos that underlie the order of creation...` |

### `public/data/glossary/entries/classes/warlock_subclasses/fiend.json`

| Line | Snippet |
|---|---|
| 22 | `"markdown": "# Fiend Patron\r\n\r\n**Make a Deal with the Lower Planes**\r\n\r\nYour pact draws on the Lower Planes, the realms of perdition. You migh...` |

### `public/data/glossary/entries/races/air_genasi.json`

| Line | Snippet |
|---|---|
| 28 | `"description": "You can hold your breath indefinitely while you are not [[incapacitated_condition\|Incapacitated]]."` |

### `public/data/glossary/entries/races/shifter_variants/wildhunt.json`

| Line | Snippet |
|---|---|
| 47 | `"description": "While shifted, you have [[advantage]] on Wisdom checks, and no creature within 30 feet of you can make an attack roll with advantage a...` |
| 62 | `"incapacitated"` |

### `public/data/glossary/entries/races/simic_hybrid.json`

| Line | Snippet |
|---|---|
| 41 | `"description": "Your body has been altered to incorporate certain animal characteristics. You choose one animal enhancement now and a second enhanceme...` |

### `public/data/glossary/entries/rules/actions.json`

| Line | Snippet |
|---|---|
| 20 | `"markdown": "# Actions\r\n<p class=\"glossary-intro-quote\">When you do something other than moving or communicating, you typically take an action. Th...` |

### `public/data/glossary/entries/rules/concentration.json`

| Line | Snippet |
|---|---|
| 13 | `"markdown": "# Concentration\n\nSome spells require you to maintain concentration in order to keep their magic active. If you lose concentration, such...` |

### `public/data/glossary/entries/rules/conditions/incapacitated_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Incapacitated",` |
| 7 | `"incapacitated",` |
| 10 | `"excerpt": "An incapacitated creature can't take any action, Bonus Action, or Reaction, can't speak, and their Concentration is broken.",` |
| 19 | `"markdown": "# Incapacitated\r\n\r\nWhile you have the Incapacitated condition, you experience the following effects:\r\n\r\n*   **Inactive.** You can...` |

### `public/data/glossary/entries/rules/conditions/paralyzed_condition.json`

| Line | Snippet |
|---|---|
| 8 | `"incapacitated"` |
| 10 | `"excerpt": "A paralyzed creature is Incapacitated, can't move or speak, and automatically fails Strength and Dexterity saving throws. Attacks against ...` |
| 17 | `"markdown": "# Paralyzed\r\n\r\nWhile you have the Paralyzed condition, you experience the following effects:\r\n\r\n*   **Incapacitated.** You have t...` |

### `public/data/glossary/entries/rules/conditions/petrified_condition.json`

| Line | Snippet |
|---|---|
| 10 | `"excerpt": "A petrified creature is transformed into a solid inanimate substance. It is Incapacitated, can't move or speak, has resistance to all dama...` |
| 17 | `"markdown": "# Petrified\r\n\r\nWhile you have the Petrified condition, you experience the following effects:\r\n\r\n*   **Turned to Inanimate Substan...` |

### `public/data/glossary/entries/rules/conditions/stunned_condition.json`

| Line | Snippet |
|---|---|
| 8 | `"incapacitated"` |
| 10 | `"excerpt": "A stunned creature is Incapacitated, automatically fails Strength and Dexterity saving throws, and attack rolls against it have Advantage....` |
| 16 | `"markdown": "# Stunned\r\n\r\nWhile you have the Stunned condition, you experience the following effects:\r\n\r\n*   **Incapacitated.** You have the <...` |

### `public/data/glossary/entries/rules/conditions/unconscious_condition.json`

| Line | Snippet |
|---|---|
| 8 | `"incapacitated"` |
| 10 | `"excerpt": "An unconscious creature is Incapacitated, Prone, and unaware of its surroundings. It drops what it's holding and automatically fails Stren...` |
| 18 | `"markdown": "# Unconscious\r\n\r\nWhile you have the Unconscious condition, you experience the following effects:\r\n\r\n*   **Inert.** You have the <...` |

### `public/data/glossary/entries/rules/crafting/poison_crafting.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Poison Crafting\n\nProficiency with a **Poisoner's Kit** allows you to harvest venom and create deadly toxins without risking exposure....` |

### `public/data/glossary/entries/rules/movement/flying.json`

| Line | Snippet |
|---|---|
| 11 | `"excerpt": "A variety of effects allow a creature to fly. While flying, you fall if you have the Incapacitated or Prone condition or your Fly Speed is...` |
| 21 | `"markdown": "# Flying\r\nA variety of effects allow a creature to fly. While flying, you fall if you have the <span data-term-id=\"incapacitated_condi...` |

### `public/data/glossary/entries/rules/spells/spell_duration_rules.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Spell Duration Rules\r\n\r\nA spell's duration is the length of time the spell persists after it is cast. A duration typically takes on...` |

### `public/data/glossary/index/character_races.json`

| Line | Snippet |
|---|---|
| 2434 | `"incapacitated"` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 1126 | `"excerpt": "A variety of effects allow a creature to fly. While flying, you fall if you have the Incapacitated or Prone condition or your Fly Speed is...` |
| 1323 | `"title": "Incapacitated",` |
| 1327 | `"incapacitated",` |
| 1330 | `"excerpt": "An incapacitated creature can't take any action, Bonus Action, or Reaction, can't speak, and their Concentration is broken.",` |
| 1781 | `"incapacitated"` |
| 1783 | `"excerpt": "A paralyzed creature is Incapacitated, can't move or speak, and automatically fails Strength and Dexterity saving throws. Attacks against ...` |
| 1810 | `"excerpt": "A petrified creature is transformed into a solid inanimate substance. It is Incapacitated, can't move or speak, has resistance to all dama...` |
| 2470 | `"incapacitated"` |
| 2472 | `"excerpt": "A stunned creature is Incapacitated, automatically fails Strength and Dexterity saving throws, and attack rolls against it have Advantage....` |
| 2742 | `"incapacitated"` |
| 2744 | `"excerpt": "An unconscious creature is Incapacitated, Prone, and unaware of its surroundings. It drops what it's holding and automatically fails Stren...` |

### `public/data/spells/level-1/tashas-hideous-laughter.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "Target is prone and incapacitated on a failed save; repeats Wisdom saves at end of turns and after taking damage (with Advantage if da...` |
| 104 | `"name": "Prone, Incapacitated",` |
| 136 | `"description": "A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter if t...` |

### `public/data/spells/level-2/enhance-ability.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until...` |
| 141 | `"description": "You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until...` |

### `public/data/spells/level-2/enthrall.json`

| Line | Snippet |
|---|---|
| 138 | `"description": "You weave a distracting string of words, causing creatures of your choice that you can see within range and that can hear you to make ...` |

### `public/data/spells/level-3/feign-death.json`

| Line | Snippet |
|---|---|
| 160 | `"name": "Incapacitated",` |
| 190 | `"description": "You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the duration, the target has...` |

### `public/data/spells/level-3/gaseous-form.json`

| Line | Snippet |
|---|---|
| 103 | `"description": "You transform a willing creature you touch, along with everything it's wearing and carrying, into a misty cloud for the duration. The ...` |
| 139 | `"description": "You transform a willing creature you touch, along with everything it's wearing and carrying, into a misty cloud for the duration. The ...` |

### `public/data/spells/level-3/haste.json`

| Line | Snippet |
|---|---|
| 103 | `"name": "Incapacitated",` |

### `public/data/spells/level-3/hypnotic-pattern.json`

| Line | Snippet |
|---|---|
| 160 | `"name": "Incapacitated",` |
| 190 | `"description": "You create a twisting pattern of colors that weaves through the air inside a 30-foot Cube within range. The pattern appears for a mome...` |

### `public/data/spells/level-4/banishment.json`

| Line | Snippet |
|---|---|
| 105 | `"name": "Incapacitated",` |
| 191 | `"description": "One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the d...` |

### `public/data/spells/level-5/contact-other-plane.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from another plane. Contacting this...` |
| 138 | `"description": "You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from another plane. Contacting this...` |

### `public/data/spells/level-5/dream.json`

| Line | Snippet |
|---|---|
| 103 | `"description": "You target a creature you know on the same plane of existence. You or a willing creature you touch enters a trance state to act as a d...` |
| 139 | `"description": "You target a creature you know on the same plane of existence. You or a willing creature you touch enters a trance state to act as a d...` |

### `public/data/spells/level-5/modify-memory.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting...` |
| 138 | `"description": "You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting...` |

### `public/data/spells/level-6/wind-walk.json`

| Line | Snippet |
|---|---|
| 101 | `"description": "You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. Whil...` |
| 137 | `"description": "You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. Whil...` |

