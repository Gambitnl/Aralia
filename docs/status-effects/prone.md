# Prone Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `devtools/roadmap/src/components/debug/roadmap/graph.ts`

| Line | Snippet |
|---|---|
| 53 | `// Layman: catches "visually flat" connectors that are prone to glow-filter render glitches.` |

### `src/commands/__tests__/StatusConditionCommand.test.ts`

| Line | Snippet |
|---|---|
| 106 | `statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 2 } },` |
| 115 | `expect(updated?.conditions?.[0]?.name).toBe('Prone');` |
| 121 | `expect(updated?.statusEffects[0]?.name).toBe('Prone');` |
| 125 | `expect(lastLog?.message).toContain('Prone');` |
| 135 | `statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 1 } },` |

### `src/commands/__tests__/UtilityCommand.test.ts`

| Line | Snippet |
|---|---|
| 94 | `it('should apply "grovel" command (prone status)', () => {` |
| 112 | `expect(targetInState?.statusEffects[0].name).toBe('Prone')` |
| 115 | `const logEntry = newState.combatLog.find(l => l.message.includes('falls prone'))` |

### `src/commands/effects/UtilityCommand.ts`

| Line | Snippet |
|---|---|
| 162 | `return this.addStatus(state, target, 'Prone', `${target.name} falls prone (grovel)`)` |

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 20 | `'Prone': '🛌',` |

### `src/data/backgrounds.ts`

| Line | Snippet |
|---|---|
| 394 | `flaws: ['I am socially awkward', 'I am suspicious of strangers', 'I am prone to visions or madness']` |

### `src/data/feats/featsData.ts`

| Line | Snippet |
|---|---|
| 48 | `description: 'Your body is a finely tuned instrument. Gain Strength or Dexterity +1; your Climb Speed equals your walk speed, standing from Prone cost...` |

### `src/data/masteryData.ts`

| Line | Snippet |
|---|---|
| 13 | `Topple: { id: 'Topple', name: 'Topple', description: 'On hit against a Large or smaller creature, you can force it to make a Constitution saving throw...` |

### `src/data/races/astral_elf.ts`

| Line | Snippet |
|---|---|
| 13 | `'Long ago, groups of elves ventured from the Feywild to the Astral Plane to be closer to their gods. Life in the Silver Void has imbued their souls wi...` |

### `src/data/races/goliath.ts`

| Line | Snippet |
|---|---|
| 30 | `description: "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition. You ca...` |

### `src/data/races/hill_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 4 | `* Hill Giant goliaths can knock their enemies prone with powerful strikes.` |
| 21 | `'Hill\'s Tumble: When you hit a Large or smaller creature with an attack roll, you can knock the target prone. You can use this trait a number of time...` |

### `src/data/races/lightfoot_halfling.ts`

| Line | Snippet |
|---|---|
| 13 | `'As a lightfoot halfling, you can easily hide from notice, even using other people as cover. You\'re inclined to be affable and get along well with ot...` |

### `src/systems/environment/__tests__/hazards.test.ts`

| Line | Snippet |
|---|---|
| 29 | `expect(result.statusEffect?.name).toBe('Prone');` |

### `src/systems/environment/hazards.ts`

| Line | Snippet |
|---|---|
| 37 | `description: 'Ground covered in slick ice. Creatures may fall prone.',` |
| 120 | `name: hazard.id === 'slippery_ice' ? 'Prone' :` |

### `src/systems/spells/__tests__/DefenderFilter.test.ts`

| Line | Snippet |
|---|---|
| 20 | `conditions: ['Prone']` |
| 27 | `expect(effect.mechanics?.attackerFilter?.conditions).toContain('Prone');` |

### `src/test/contracts/statusEffects.contract.test.ts`

| Line | Snippet |
|---|---|
| 33 | `name: 'Prone',` |

### `src/types/combat.d.ts`

| Line | Snippet |
|---|---|
| 58 | `* These are distinct from Conditions (Prone, Stunned) as they often carry specific mechanics or durations.` |
| 123 | `/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */` |

### `src/types/combat.ts`

| Line | Snippet |
|---|---|
| 71 | `* These are distinct from Conditions (Prone, Stunned) as they often carry specific mechanics or durations.` |
| 137 | `/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 20 | `Prone = "Prone",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 20 | `Prone = 'Prone',` |
| 145 | `[ConditionType.Prone]: {` |
| 182 | `"Fall Prone",` |

### `src/types/creatures.ts`

| Line | Snippet |
|---|---|
| 74 | `conditionImmunities: ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Prone'],` |

### `src/types/dungeon.ts`

| Line | Snippet |
|---|---|
| 211 | `* 'sleeping': Prone, unconscious.` |

### `src/types/spells.d.ts`

| Line | Snippet |
|---|---|
| 282 | `export type ConditionName = "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened" \| "Grappled" \| "Incapacitated" \| "Invisible" \| "P...` |
| 349 | `/** Conditions the target must have (e.g., ["Prone", "Charmed"]) */` |

### `src/types/spells.ts`

| Line | Snippet |
|---|---|
| 458 | `\| "Poisoned" \| "Prone" \| "Restrained" \| "Stunned" \| "Unconscious" \| "Ignited"` |
| 543 | `/** Conditions the target must have (e.g., ["Prone", "Charmed"]) */` |

### `src/types/visuals.ts`

| Line | Snippet |
|---|---|
| 470 | `prone: { id: 'prone', label: 'Prone', icon: '🛌', color: '#6B7280', description: 'Only movement option is to crawl. Attack rolls have disadvantage.' }...` |

### `src/utils/combat/physicsUtils.ts`

| Line | Snippet |
|---|---|
| 46 | `/** Whether the character is crawling (prone). Adds 1ft cost per ft. */` |
| 122 | `* The creature lands prone unless they avoid taking damage.` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 191 | `\| 'prone'` |

### `.jules/manifests/worklog_backlog.md`

| Line | Snippet |
|---|---|
| 598 | `- Shell Defense (action to withdraw, +4 AC, prone, speed 0)` |

### `docs/@JULES-WORKFLOW-GUIDE.md`

| Line | Snippet |
|---|---|
| 10 | `It captures a coordination style that was useful for parallel agent work, especially when shared docs and registry files were prone to merge conflicts...` |

### `docs/improvements/SPRITE-POSE-CONTROL-VARIANTS.md`

| Line | Snippet |
|---|---|
| 12 | `- The current behavior is gameplay-first: movement, prone application, and combat-log updates already happen without waiting on any sprite-generation ...` |

### `docs/spells/reference/level-1/grease.md`

| Line | Snippet |
|---|---|
| 35 | `- **Conditions Applied**: Prone` |
| 38 | `- **Description**: Slick grease covers the ground in a 10-foot square freely centered on a point within range and turns it into Difficult Terrain for ...` |

### `docs/spells/reference/level-1/tashas-hideous-laughter.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Incapacitated, Prone` |
| 34 | `- **Description**: A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter i...` |

### `docs/spells/reference/level-1/thunderous-smite.md`

| Line | Snippet |
|---|---|
| 30 | `- **Conditions Applied**: Prone` |
| 32 | `- **Description**: The first time you hit with a melee weapon attack during this spell's duration, your weapon rings with thunder that is audible with...` |

### `docs/spells/reference/level-3/meld-into-stone.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You step into a stone object or surface large enough to fully contain your body, melding yourself and all the equipment you carry w...` |

### `docs/spells/reference/level-3/sleet-storm.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Prone` |
| 36 | `- **Description**: Until the spell ends, freezing rain and sleet fall in a 20-foot-tall Cylinder with a 40-foot radius centered on a point you choose ...` |

### `docs/spells/reference/level-3/tidal-wave.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Prone` |
| 36 | `- **Description**: You conjure a wave of water that crashes down on an area within range. The area can be up to 30 feet long, up to 10 feet wide, and ...` |

### `docs/spells/reference/level-4/watery-sphere.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You conjure up a sphere of water with a 5-foot radius on a point you can see within range. The sphere can hover in the air, but no ...` |

### `docs/spells/reference/level-5/destructive-wave.md`

| Line | Snippet |
|---|---|
| 34 | `- **Description**: Destructive energy ripples outward from you in a 30-foot Emanation. Each creature you choose in the Emanation makes a Constitution ...` |

### `docs/spells/reference/level-5/wrath-of-nature.md`

| Line | Snippet |
|---|---|
| 33 | `- **Conditions Applied**: Restrained, Prone` |
| 35 | `- **Description**: You call out to the spirits of nature to rouse them against your enemies. Choose a point you can see within range. The spirits caus...` |

### `docs/spells/reference/level-6/investiture-of-stone.md`

| Line | Snippet |
|---|---|
| 38 | `* You can use your action to create a small earthquake on the ground in a 15-foot radius centered on you. Other creatures on that ground must succeed ...` |

### `docs/spells/reference/level-8/demiplane.md`

| Line | Snippet |
|---|---|
| 31 | `- **Description**: You create a shadowy Medium door on a flat solid surface that you can see within range. This door can be opened and closed, and it ...` |

### `docs/spells/reference/level-8/earthquake.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through the ground in a 100-fo...` |

### `docs/spells/reference/level-8/reality-break.md`

| Line | Snippet |
|---|---|
| 41 | `\| 6-8 \| **Wormhole.** The target is teleported, along with everything it is wearing and carrying, up to 30 feet to an unoccupied space of your choic...` |

### `docs/spells/reference/level-9/power-word-heal.md`

| Line | Snippet |
|---|---|
| 29 | `- **Description**: A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature ...` |

### `docs/tasks/investigations/DICE_ROLLER_ANALYSIS.md`

| Line | Snippet |
|---|---|
| 73 | `**Risk**: `useDiceBox.ts` contains critical fixes for React Strict Mode (removing stale canvases) that are **missing** from `DiceService.ts`. This sug...` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

### `docs/tasks/spell-system-overhaul/LEVEL-1-BATCHES.md`

| Line | Snippet |
|---|---|
| 41 | `- Notes: Goodberry 10 berries heal 1 HP each; Grease 10-ft square prone save; Guiding Bolt ranged attack radiant + next attack advantage, +1d6/slot; H...` |
| 61 | `- Notes: Sleep HP-pool slumber scaling; Speak with Animals (ritual) simple communication; Tasha's Caustic Brew line acid ongoing until washed, Dex sav...` |
| 65 | `- Notes: Thunderous Smite next melee hit thunder + push/prone save, conc; Thunderwave cube Con save 2d8 thunder push on fail, +1d8/slot; Unseen Servan...` |

### `src/components/ui/ErrorBoundary.README.md`

| Line | Snippet |
|---|---|
| 57 | `The `ErrorBoundary` component should be wrapped around sections of the UI that are prone to errors or where an error should not bring down the entire ...` |

### `src/styles/README.md`

| Line | Snippet |
|---|---|
| 13 | `- **Magic Numbers**: Hardcoded values like `z-[100]` are meaningless and error-prone` |

### `src/utils/Utils_Ralph.md`

| Line | Snippet |
|---|---|
| 21 | `- **Retroactive Math**: `performLevelUp` retroactive HP calculations are complex and prone to edge cases if a character gains CON from multiple source...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/artificer_infusions.json`

| Line | Snippet |
|---|---|
| 18 | `"markdown": "# Artificer Infusions\r\nArtificer infusions are extraordinary processes that rapidly turn a nonmagical object into a magic item. The des...` |

### `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_wild_heart.json`

| Line | Snippet |
|---|---|
| 22 | `"markdown": "# Path of the Wild Heart\r\n\r\n**Walk in Community with the Animal World**\r\n\r\nBarbarians who follow the Path of the Wild Heart view ...` |

### `public/data/glossary/entries/classes/fighter_subclasses/battle_master.json`

| Line | Snippet |
|---|---|
| 18 | `"markdown": "# Battle Master\r\n\r\n**Master Sophisticated Battle Maneuvers**\r\n\r\nBattle Masters are students of the art of battle, learning martia...` |

### `public/data/glossary/entries/classes/fighter_subclasses/psi_warrior.json`

| Line | Snippet |
|---|---|
| 19 | `"markdown": "# Psi Warrior\r\n\r\n**Augment Physical Might with Psionic Power**\r\n\r\nPsi Warriors awaken the power of their minds to augment their p...` |

### `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_open_hand.json`

| Line | Snippet |
|---|---|
| 22 | `"markdown": "# Warrior of the Open Hand\r\n\r\n**Master Unarmed Combat Techniques**\r\n\r\nWarriors of the Open Hand are masters of unarmed combat. Th...` |

### `public/data/glossary/entries/classes/rogue.json`

| Line | Snippet |
|---|---|
| 30 | `"markdown": "# Rogue\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg s...` |

### `public/data/glossary/entries/classes/warlock_subclasses/celestial.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Celestial Patron\r\n\r\n**Call on the Power of the Heavens**\r\n\r\nYour pact draws on the Upper Planes, the realms of everlasting blis...` |

### `public/data/glossary/entries/races/air_genasi.json`

| Line | Snippet |
|---|---|
| 11 | `"typicalAssociation": "Air genasi lean toward chaotic alignments, valuing personal freedom above structured systems. They're often impulsive, quick-th...` |

### `public/data/glossary/entries/races/elf_lineages/astral_elf.json`

| Line | Snippet |
|---|---|
| 5 | `"entryLore": "Long ago, groups of elves ventured from the Feywild to the Astral Plane to be closer to their gods. Life in the Silver Void has imbued t...` |

### `public/data/glossary/entries/races/goliath_ancestries/hill_giant_goliath.json`

| Line | Snippet |
|---|---|
| 17 | `"value": "Hill's Tumble (Knock Prone)"` |
| 24 | `"description": "When you hit a Large or smaller creature with an attack roll, you can knock the target [[prone_condition\|Prone]]. You can use this tr...` |
| 31 | `"prone",` |

### `public/data/glossary/entries/races/halfling_subraces/lightfoot.json`

| Line | Snippet |
|---|---|
| 5 | `"entryLore": "As a lightfoot halfling, you can easily hide from notice, even using other people as cover. You're inclined to be affable and get along ...` |

### `public/data/glossary/entries/races/harengon.json`

| Line | Snippet |
|---|---|
| 42 | `"description": "When you fail a Dexterity saving throw, you can use your [[reaction]] to roll a d4 and add it to the save, potentially turning the fai...` |

### `public/data/glossary/entries/races/tortle.json`

| Line | Snippet |
|---|---|
| 47 | `"description": "As an [[action\|Action]], you can withdraw into your shell. Until you emerge, you gain a +4 bonus to your AC, and you have [[advantage...` |

### `public/data/glossary/entries/rules/advantage.json`

| Line | Snippet |
|---|---|
| 13 | `"markdown": "# Advantage\n\nSometimes a special ability or spell tells you that you have advantage on a d20 roll. When that happens, you roll a second...` |

### `public/data/glossary/entries/rules/conditions/prone_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Prone",` |
| 7 | `"prone",` |
| 10 | `"excerpt": "A prone creature's only movement option is to crawl or stand up. It has Disadvantage on attack rolls, and attacks against it have Advantag...` |
| 16 | `"markdown": "# Prone\r\n\r\nWhile you have the Prone condition, you experience the following effects:\r\n\r\n*   **Restricted Movement.** Your only mo...` |

### `public/data/glossary/entries/rules/conditions/unconscious_condition.json`

| Line | Snippet |
|---|---|
| 10 | `"excerpt": "An unconscious creature is Incapacitated, Prone, and unaware of its surroundings. It drops what it's holding and automatically fails Stren...` |
| 18 | `"markdown": "# Unconscious\r\n\r\nWhile you have the Unconscious condition, you experience the following effects:\r\n\r\n*   **Inert.** You have the <...` |

### `public/data/glossary/entries/rules/disadvantage.json`

| Line | Snippet |
|---|---|
| 13 | `"markdown": "# Disadvantage\n\nSometimes a special ability or spell tells you that you have disadvantage on a d20 roll. When that happens, you roll a ...` |

### `public/data/glossary/entries/rules/duration_condition.json`

| Line | Snippet |
|---|---|
| 16 | `"markdown": "# Duration of Conditions\r\n\r\nA condition lasts either for a duration specified by the effect that imposed the condition or until the c...` |

### `public/data/glossary/entries/rules/equipment/weapons/mastery_properties/topple.json`

| Line | Snippet |
|---|---|
| 10 | `"markdown": "# Topple Mastery\r\nIf you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the...` |

### `public/data/glossary/entries/rules/movement/crawling.json`

| Line | Snippet |
|---|---|
| 10 | `"prone"` |
| 12 | `"excerpt": "While crawling, each foot of movement costs 1 extra foot. Crawling is often associated with the Prone condition.",` |

### `public/data/glossary/entries/rules/movement/flying.json`

| Line | Snippet |
|---|---|
| 11 | `"excerpt": "A variety of effects allow a creature to fly. While flying, you fall if you have the Incapacitated or Prone condition or your Fly Speed is...` |
| 21 | `"markdown": "# Flying\r\nA variety of effects allow a creature to fly. While flying, you fall if you have the <span data-term-id=\"incapacitated_condi...` |

### `public/data/glossary/entries/rules/movement/jumping.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Jumping\r\nWhen you jump, you make either a Long Jump (horizontal) or a High Jump (vertical). \r\n\r\n<details class=\"feature-card\">\...` |

### `public/data/glossary/index/character_races.json`

| Line | Snippet |
|---|---|
| 1523 | `"prone",` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 791 | `"prone"` |
| 793 | `"excerpt": "While crawling, each foot of movement costs 1 extra foot. Crawling is often associated with the Prone condition.",` |
| 1126 | `"excerpt": "A variety of effects allow a creature to fly. While flying, you fall if you have the Incapacitated or Prone condition or your Fly Speed is...` |
| 1968 | `"title": "Prone",` |
| 1972 | `"prone",` |
| 1975 | `"excerpt": "A prone creature's only movement option is to crawl or stand up. It has Disadvantage on attack rolls, and attacks against it have Advantag...` |
| 2744 | `"excerpt": "An unconscious creature is Incapacitated, Prone, and unaware of its surroundings. It drops what it's holding and automatically fails Stren...` |

### `public/data/spells/level-0/sapping-sting.json`

| Line | Snippet |
|---|---|
| 144 | `"name": "Prone",` |
| 174 | `"description": "You sap the vitality of one creature you can see in range. The target must succeed on a Constitution saving throw or take 1d4 necrotic...` |

### `public/data/spells/level-1/command.json`

| Line | Snippet |
|---|---|
| 128 | `"details": "Target falls prone and ends its turn."` |

### `public/data/spells/level-1/grease.json`

| Line | Snippet |
|---|---|
| 173 | `"name": "Prone",` |
| 229 | `"name": "Prone",` |
| 285 | `"name": "Prone",` |
| 315 | `"description": "Slick grease covers the ground in a 10-foot square freely centered on a point within range and turns it into Difficult Terrain for the...` |

### `public/data/spells/level-1/tashas-hideous-laughter.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "Target is prone and incapacitated on a failed save; repeats Wisdom saves at end of turns and after taking damage (with Advantage if da...` |
| 104 | `"name": "Prone, Incapacitated",` |
| 136 | `"description": "A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter if t...` |

### `public/data/spells/level-1/thunderous-smite.json`

| Line | Snippet |
|---|---|
| 144 | `"name": "Prone",` |
| 228 | `"description": "The first time you hit with a melee weapon attack during this spell's duration, your weapon rings with thunder that is audible within ...` |

### `public/data/spells/level-3/meld-into-stone.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You step into a stone object or surface large enough to fully contain your body, melding yourself and all the equipment you carry with...` |
| 138 | `"description": "You step into a stone object or surface large enough to fully contain your body, melding yourself and all the equipment you carry with...` |

### `public/data/spells/level-3/sleet-storm.json`

| Line | Snippet |
|---|---|
| 103 | `"name": "Prone",` |
| 133 | `"description": "Until the spell ends, freezing rain and sleet fall in a 20-foot-tall Cylinder with a 40-foot radius centered on a point you choose wit...` |

### `public/data/spells/level-3/tidal-wave.json`

| Line | Snippet |
|---|---|
| 145 | `"name": "Prone",` |
| 175 | `"description": "You conjure a wave of water that crashes down on an area within range. The area can be up to 30 feet long, up to 10 feet wide, and up ...` |

### `public/data/spells/level-4/watery-sphere.json`

| Line | Snippet |
|---|---|
| 133 | `"description": "You conjure up a sphere of water with a 5-foot radius on a point you can see within range. The sphere can hover in the air, but no mor...` |

### `public/data/spells/level-5/destructive-wave.json`

| Line | Snippet |
|---|---|
| 117 | `"description": "Destructive energy ripples outward from you in a 30-foot Emanation. Each creature you choose in the Emanation makes a Constitution sav...` |

### `public/data/spells/level-5/wrath-of-nature.json`

| Line | Snippet |
|---|---|
| 200 | `"name": "Prone",` |
| 230 | `"description": "You call out to the spirits of nature to rouse them against your enemies. Choose a point you can see within range. The spirits cause t...` |

### `public/data/spells/level-8/demiplane.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You create a shadowy Medium door on a flat solid surface that you can see within range. This door can be opened and closed, and it lea...` |
| 141 | `"description": "You create a shadowy Medium door on a flat solid surface that you can see within range. This door can be opened and closed, and it lea...` |

### `public/data/spells/level-8/earthquake.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through the ground in a 100-foot-...` |
| 141 | `"description": "Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through the ground in a 100-foot-...` |

### `public/data/spells/level-9/power-word-heal.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature has...` |
| 138 | `"description": "A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature has...` |

