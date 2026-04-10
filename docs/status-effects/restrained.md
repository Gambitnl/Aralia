# Restrained Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 21 | `'Restrained': '⛓️',` |

### `src/systems/environment/hazards.ts`

| Line | Snippet |
|---|---|
| 121 | `hazard.id === 'quicksand' ? 'Restrained' : 'Affected',` |

### `src/types/combat.d.ts`

| Line | Snippet |
|---|---|
| 123 | `/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */` |

### `src/types/combat.ts`

| Line | Snippet |
|---|---|
| 137 | `/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 21 | `Restrained = "Restrained",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 21 | `Restrained = 'Restrained',` |
| 154 | `[ConditionType.Restrained]: {` |

### `src/types/spells.d.ts`

| Line | Snippet |
|---|---|
| 282 | `export type ConditionName = "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened" \| "Grappled" \| "Incapacitated" \| "Invisible" \| "P...` |

### `src/types/spells.ts`

| Line | Snippet |
|---|---|
| 458 | `\| "Poisoned" \| "Prone" \| "Restrained" \| "Stunned" \| "Unconscious" \| "Ignited"` |

### `src/types/visuals.ts`

| Line | Snippet |
|---|---|
| 471 | `restrained: { id: 'restrained', label: 'Restrained', icon: '⛓️', color: '#B91C1C', description: 'Speed becomes 0. Attack rolls against the creature ha...` |

### `src/utils/combat/combatLogToMessageAdapter.ts`

| Line | Snippet |
|---|---|
| 166 | `// Default for all other status messages: "X is affected by Burning", "X is now Restrained", etc.` |
| 413 | `// Pattern 3: "X is now Restrained from zone effect!"` |

### `src/utils/combat/mechanicsUtils.ts`

| Line | Snippet |
|---|---|
| 119 | `description += " Restraints snap into place! (Restrained condition)";` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 192 | `\| 'restrained'` |

### `docs/spells/reference/level-1/ensnaring-strike.md`

| Line | Snippet |
|---|---|
| 28 | `- **Conditions Applied**: Restrained` |
| 31 | `- **Damage Trigger**: turn_start while Restrained` |
| 33 | `- **Description**: The next time you hit a creature with a weapon attack before this spell ends, a writhing mass of thorny vines appears at the point ...` |

### `docs/spells/reference/level-1/entangle.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Restrained` |
| 35 | `- **Description**: Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. For the duration, these pla...` |

### `docs/spells/reference/level-2/web.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Restrained` |
| 36 | `- **Description**: You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot Cube from that point fo...` |

### `docs/spells/reference/level-3/speak-with-plants.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You imbue plants within 30 feet of you with limited sentience and animation, giving them the ability to communicate with you and fo...` |

### `docs/spells/reference/level-4/evards-black-tentacles.md`

| Line | Snippet |
|---|---|
| 36 | `- **Conditions Applied**: Restrained` |
| 38 | `- **Description**: Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn th...` |

### `docs/spells/reference/level-4/freedom-of-movement.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magi...` |

### `docs/spells/reference/level-4/watery-sphere.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Restrained` |
| 36 | `- **Description**: You conjure up a sphere of water with a 5-foot radius on a point you can see within range. The sphere can hover in the air, but no ...` |

### `docs/spells/reference/level-5/conjure-elemental.md`

| Line | Snippet |
|---|---|
| 33 | `- **Description**: You conjure a Large, intangible spirit from the Elemental Planes that appears in an unoccupied space within range. Choose the spiri...` |

### `docs/spells/reference/level-5/telekinesis.md`

| Line | Snippet |
|---|---|
| 29 | `- **Conditions Applied**: Restrained` |
| 31 | `- **Description**: You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell and as a Magic action on your l...` |

### `docs/spells/reference/level-5/transmute-rock.md`

| Line | Snippet |
|---|---|
| 35 | `- **Description**: You choose an area of stone or mud that you can see that fits within a 40-foot cube and that is within range, and choose one of the...` |

### `docs/spells/reference/level-5/wrath-of-nature.md`

| Line | Snippet |
|---|---|
| 33 | `- **Conditions Applied**: Restrained, Prone` |
| 35 | `- **Description**: You call out to the spirits of nature to rouse them against your enemies. Choose a point you can see within range. The spirits caus...` |

### `docs/spells/reference/level-6/bones-of-the-earth.md`

| Line | Snippet |
|---|---|
| 35 | `- **Description**: You cause up to six pillars of stone to burst from places on the ground that you can see within range. Each pillar is a cylinder th...` |

### `docs/spells/reference/level-6/flesh-to-stone.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must...` |

### `docs/spells/reference/level-6/mental-prison.md`

| Line | Snippet |
|---|---|
| 37 | `- **Description**: You attempt to bind a creature within an illusory cell that only it perceives. One creature you can see within range must make an I...` |

### `docs/spells/reference/level-7/prismatic-spray.md`

| Line | Snippet |
|---|---|
| 41 | `\| 6 \| Indigo. Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it succ...` |

### `docs/spells/reference/level-7/whirlwind.md`

| Line | Snippet |
|---|---|
| 37 | `- **Description**: A whirlwind howls down to a point on the ground you specify. The whirlwind is a 10-foot-radius, 30-foot-high cylinder centered on t...` |

### `docs/spells/reference/level-9/imprisonment.md`

| Line | Snippet |
|---|---|
| 35 | `- **Chaining.** Chains firmly rooted in the ground hold the target in place. The target has the Restrained condition and can't be moved by any means.` |

### `docs/spells/reference/level-9/prismatic-wall.md`

| Line | Snippet |
|---|---|
| 37 | `- **Indigo**: Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it succes...` |

### `docs/spells/reference/level-9/ravenous-void.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You create a 20-foot-radius sphere of destructive gravitation force centered on a point you can see within range. For the spell's d...` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/paladin_subclasses/oath_of_the_ancients.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Oath of the Ancients\r\n\r\n**Preserve Life and Light in the World**\r\n\r\nThe Oath of the Ancients is as old as the first elves. Pala...` |

### `public/data/glossary/entries/races/deep_gnome.json`

| Line | Snippet |
|---|---|
| 11 | `"typicalAssociation": "Deep gnomes are wary survivors who trust slowly but can be fiercely loyal once bonds form. Many tend toward practical, restrain...` |

### `public/data/glossary/entries/rules/conditions/restrained_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Restrained",` |
| 7 | `"restrained",` |
| 10 | `"excerpt": "A restrained creature's speed becomes 0. Attack rolls against it have Advantage, its attack rolls have Disadvantage, and it has Disadvanta...` |
| 16 | `"markdown": "# Restrained\r\n\r\nWhile you have the Restrained condition, you experience the following effects:\r\n\r\n*   **Speed 0.** Your <span dat...` |

### `public/data/glossary/entries/rules/disadvantage.json`

| Line | Snippet |
|---|---|
| 13 | `"markdown": "# Disadvantage\n\nSometimes a special ability or spell tells you that you have disadvantage on a d20 roll. When that happens, you roll a ...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 2073 | `"title": "Restrained",` |
| 2077 | `"restrained",` |
| 2080 | `"excerpt": "A restrained creature's speed becomes 0. Attack rolls against it have Advantage, its attack rolls have Disadvantage, and it has Disadvanta...` |

### `public/data/spells/level-1/ensnaring-strike.json`

| Line | Snippet |
|---|---|
| 123 | `"name": "Restrained",` |
| 175 | `"Restrained"` |
| 206 | `"description": "The next time you hit a creature with a weapon attack before this spell ends, a writhing mass of thorny vines appears at the point of ...` |

### `public/data/spells/level-1/entangle.json`

| Line | Snippet |
|---|---|
| 172 | `"name": "Restrained",` |
| 230 | `"name": "Restrained",` |
| 249 | `"description": "A creature that moves into the area for the first time on a turn must succeed on a Strength saving throw or be restrained.",` |
| 288 | `"name": "Restrained",` |
| 307 | `"description": "A creature that ends its turn in the area must succeed on a Strength saving throw or be restrained.",` |
| 320 | `"description": "Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. For the duration, these plants...` |

### `public/data/spells/level-1/snare.json`

| Line | Snippet |
|---|---|
| 103 | `"name": "Restrained",` |
| 196 | `"description": "You weave a 5-foot circle of rope on the ground to create a magical trap. The rope is consumed when you cast the spell. The trap is ne...` |

### `public/data/spells/level-2/web.json`

| Line | Snippet |
|---|---|
| 172 | `"name": "Restrained",` |
| 190 | `"description": "On a failed Dex save, a creature entering or starting its turn in the webs is restrained.",` |
| 245 | `"description": "You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot Cube from that point for t...` |

### `public/data/spells/level-3/speak-with-plants.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You imbue plants within 30 feet of you with limited sentience and animation, giving them the ability to communicate with you and follo...` |
| 141 | `"description": "You imbue plants within 30 feet of you with limited sentience and animation, giving them the ability to communicate with you and follo...` |

### `public/data/spells/level-4/evards-black-tentacles.json`

| Line | Snippet |
|---|---|
| 143 | `"name": "Restrained",` |
| 173 | `"description": "Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the g...` |

### `public/data/spells/level-4/freedom-of-movement.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |
| 141 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |

### `public/data/spells/level-4/watery-sphere.json`

| Line | Snippet |
|---|---|
| 103 | `"name": "Restrained",` |
| 133 | `"description": "You conjure up a sphere of water with a 5-foot radius on a point you can see within range. The sphere can hover in the air, but no mor...` |

### `public/data/spells/level-5/conjure-elemental.json`

| Line | Snippet |
|---|---|
| 118 | `"description": "You conjure a Large, intangible spirit from the Elemental Planes that appears in an unoccupied space within range. Choose the spirit's...` |

### `public/data/spells/level-5/telekinesis.json`

| Line | Snippet |
|---|---|
| 103 | `"name": "Restrained",` |
| 133 | `"description": "You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell and as a Magic action on your late...` |

### `public/data/spells/level-5/transmute-rock.json`

| Line | Snippet |
|---|---|
| 119 | `"description": "You choose an area of stone or mud that you can see that fits within a 40-foot cube and that is within range, and choose one of the fo...` |

### `public/data/spells/level-5/wrath-of-nature.json`

| Line | Snippet |
|---|---|
| 144 | `"name": "Restrained",` |
| 230 | `"description": "You call out to the spirits of nature to rouse them against your enemies. Choose a point you can see within range. The spirits cause t...` |

### `public/data/spells/level-6/bones-of-the-earth.json`

| Line | Snippet |
|---|---|
| 117 | `"description": "You cause up to six pillars of stone to burst from places on the ground that you can see within range. Each pillar is a cylinder that ...` |

### `public/data/spells/level-6/flesh-to-stone.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must ma...` |
| 138 | `"description": "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must ma...` |

### `public/data/spells/level-6/mental-prison.json`

| Line | Snippet |
|---|---|
| 119 | `"description": "You attempt to bind a creature within an illusory cell that only it perceives. One creature you can see within range must make an Inte...` |

### `public/data/spells/level-7/whirlwind.json`

| Line | Snippet |
|---|---|
| 119 | `"description": "A whirlwind howls down to a point on the ground you specify. The whirlwind is a 10-foot-radius, 30-foot-high cylinder centered on that...` |

### `public/data/spells/level-9/ravenous-void.json`

| Line | Snippet |
|---|---|
| 117 | `"description": "You create a 20-foot-radius sphere of destructive gravitation force centered on a point you can see within range. For the spell's dura...` |

