# Blinded Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 10 | `'Blinded': '👁️',` |

### `src/types/__tests__/spells.test.ts`

| Line | Snippet |
|---|---|
| 49 | `statusCondition: { name: 'Blinded', duration: {type: 'rounds', value: 1} },` |

### `src/types/__tests__/visuals.test.ts`

| Line | Snippet |
|---|---|
| 9 | `{ input: 'blinded', expectedId: 'blinded', expectedIcon: '👁️' },` |
| 10 | `{ input: 'Blinded', expectedId: 'blinded', expectedIcon: '👁️' },` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 9 | `Blinded = "Blinded",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 9 | `Blinded = 'Blinded',` |
| 48 | `[ConditionType.Blinded]: {` |

### `src/types/creatures.ts`

| Line | Snippet |
|---|---|
| 74 | `conditionImmunities: ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Prone'],` |

### `src/types/spells.d.ts`

| Line | Snippet |
|---|---|
| 282 | `export type ConditionName = "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened" \| "Grappled" \| "Incapacitated" \| "Invisible" \| "P...` |

### `src/types/spells.ts`

| Line | Snippet |
|---|---|
| 456 | `\| "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened"` |

### `src/types/visuals.d.ts`

| Line | Snippet |
|---|---|
| 182 | `/** Unique ID for the condition (e.g., 'blinded', 'charmed'). */` |

### `src/types/visuals.ts`

| Line | Snippet |
|---|---|
| 223 | `/** Unique ID for the condition (e.g., 'blinded', 'charmed'). */` |
| 460 | `blinded: { id: 'blinded', label: 'Blinded', icon: '👁️', color: '#9CA3AF', description: 'Can’t see and automatically fails any ability check that requ...` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 180 | `\| 'blinded'` |

### `docs/spells/reference/level-1/color-spray.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Blinded` |
| 34 | `- **Description**: A dazzling array of flashing, colorful light springs from your hand. Each creature in a 15-foot Cone must succeed on a Constitution...` |

### `docs/spells/reference/level-2/beast-sense.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You touch a willing Beast. For the duration of the spell, you can use your action to see through the Beast's eyes and hear what it ...` |

### `docs/spells/reference/level-2/blindness-deafness.md`

| Line | Snippet |
|---|---|
| 29 | `- **Conditions Applied**: Blinded, Deafened` |
| 31 | `- **Description**: You can Clone a foe's eyes or ears. Choose one creature that you can see within range to make a Constitution saving throw. If it fa...` |

### `docs/spells/reference/level-2/lesser-restoration.md`

| Line | Snippet |
|---|---|
| 28 | `- **Description**: You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed,...` |

### `docs/spells/reference/level-3/blinding-smite.md`

| Line | Snippet |
|---|---|
| 31 | `- **Conditions Applied**: Blinded` |
| 33 | `- **Description**: The next time you hit a creature with a melee weapon attack during this spell's duration, your weapon flares with bright light, and...` |

### `docs/spells/reference/level-3/feign-death.md`

| Line | Snippet |
|---|---|
| 31 | `- **Conditions Applied**: Blinded, Incapacitated` |
| 33 | `- **Description**: You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the duration, the target ...` |

### `docs/spells/reference/level-3/hunger-of-hadar.md`

| Line | Snippet |
|---|---|
| 37 | `- **Description**: You open a gateway to the dark between the stars, a region infested with unknown horrors. A 20-foot-radius sphere of blackness and ...` |

### `docs/spells/reference/level-3/wall-of-sand.md`

| Line | Snippet |
|---|---|
| 34 | `- **Conditions Applied**: Blinded` |
| 36 | `- **Description**: You create a wall of swirling sand on the ground at a point you can see within range. You can make the wall up to 30 feet long, 10 ...` |

### `docs/spells/reference/level-4/aura-of-purity.md`

| Line | Snippet |
|---|---|
| 29 | `- **Description**: Purifying energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) can...` |

### `docs/spells/reference/level-5/holy-weapon.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You imbue a weapon you touch with holy power. Until the spell ends, the weapon emits bright light in a 30-foot radius and dim light...` |

### `docs/spells/reference/level-5/mislead.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You become Invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the durat...` |

### `docs/spells/reference/level-5/wall-of-light.md`

| Line | Snippet |
|---|---|
| 36 | `- **Conditions Applied**: Blinded` |
| 38 | `- **Description**: A shimmering wall of bright light appears at a point you choose within range. The wall appears in any orientation you choose: horiz...` |

### `docs/spells/reference/level-6/sunbeam.md`

| Line | Snippet |
|---|---|
| 37 | `- **Description**: A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-line. Each creature in the line must make a Constitu...` |

### `docs/spells/reference/level-7/divine-word.md`

| Line | Snippet |
|---|---|
| 35 | `\| 21-30 \| The target has the Blinded, Deafened, and Stunned conditions for 1 hour. \|` |
| 36 | `\| 31-40 \| The target has the Blinded and Deafened conditions for 10 minutes. \|` |

### `docs/spells/reference/level-7/draconic-transformation.md`

| Line | Snippet |
|---|---|
| 34 | `- **Description**: With a roar, you draw on the magic of dragons to transform yourself, taking on draconic features. You gain the following benefits u...` |

### `docs/spells/reference/level-7/prismatic-spray.md`

| Line | Snippet |
|---|---|
| 42 | `\| 7 \| Violet. Failed Save: The target has the Blinded condition and makes a Wisdom saving throw at the start of your next turn. On a Successful Save...` |

### `docs/spells/reference/level-8/holy-aura.md`

| Line | Snippet |
|---|---|
| 34 | `- **Description**: For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving...` |

### `docs/spells/reference/level-8/reality-break.md`

| Line | Snippet |
|---|---|
| 42 | `\| 9-10 \| **Chill of the Dark Void.** The target takes 10d12 cold damage, and it is blinded until the end of the turn. \|` |

### `docs/spells/reference/level-8/sunburst.md`

| Line | Snippet |
|---|---|
| 36 | `Brilliant sunlight flashes in a 60-foot-radius Sphere centered on a point you choose within range. Each creature in the Sphere makes a Constitution sa...` |
| 38 | `A creature Blinded by this spell makes another Constitution saving throw at the end of each of its turns, ending the effect on itself on a success.` |

### `docs/spells/reference/level-9/mass-heal.md`

| Line | Snippet |
|---|---|
| 29 | `- **Description**: A flood of healing energy flows from you into creatures around you. You restore up to 700 Hit Points, divided as you choose among a...` |

### `docs/spells/reference/level-9/prismatic-wall.md`

| Line | Snippet |
|---|---|
| 31 | `- **Description**: A shimmering, multicolored plane of light forms a vertical opaque wall-up to 90 feet long, 30 feet high, and 1 inch thick-centered ...` |
| 38 | `- **Violet**: Failed Save: The target has the Blinded condition and makes a Wisdom saving throw at the start of your next turn. On a successful save, ...` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

### `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`

| Line | Snippet |
|---|---|
| 15 | `- blindness-deafness.json still encodes Blinded as the concrete structured status while pushing the Blindness versus Deafness choice into description ...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/monk_subclasses/warrior_of_mercy.json`

| Line | Snippet |
|---|---|
| 20 | `"markdown": "# Warrior of Mercy\r\n\r\n**Manipulate Forces of Life and Death**\r\n\r\nWarriors of Mercy manipulate the life force of others. These Mon...` |

### `public/data/glossary/entries/classes/paladin.json`

| Line | Snippet |
|---|---|
| 29 | `"markdown": "# Paladin\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg...` |

### `public/data/glossary/entries/classes/rogue.json`

| Line | Snippet |
|---|---|
| 30 | `"markdown": "# Rogue\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg s...` |

### `public/data/glossary/entries/classes/sorcerer_subclasses/wild_magic_sorcery.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Wild Magic\r\n\r\n**Unleash Chaotic Magic**\r\n\r\nYour innate magic stems from the forces of chaos that underlie the order of creation...` |

### `public/data/glossary/entries/classes/warlock_subclasses/celestial.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Celestial Patron\r\n\r\n**Call on the Power of the Heavens**\r\n\r\nYour pact draws on the Upper Planes, the realms of everlasting blis...` |

### `public/data/glossary/entries/dev/test_entry.json`

| Line | Snippet |
|---|---|
| 25 | `"markdown": "# Exploration (Flattened View)\r\n\r\n<p class=\"glossary-intro-quote\">\r\nExploration involves delving into places that are dangerous a...` |

### `public/data/glossary/entries/rules/blindsight.json`

| Line | Snippet |
|---|---|
| 10 | `"markdown": "# Blindsight\n\nA creature with Blindsight can perceive its surroundings without relying on sight, within a specific radius. \n\nCreature...` |

### `public/data/glossary/entries/rules/conditions/blinded_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Blinded",` |
| 7 | `"blinded",` |
| 10 | `"excerpt": "A blinded creature can't see and automatically fails ability checks requiring sight. Attack rolls against the creature have Advantage, and...` |
| 16 | `"markdown": "# Blinded\r\n\r\nWhile you have the Blinded condition, you experience the following effects:\r\n\r\n*   **Can't See.** You can't see and ...` |

### `public/data/glossary/entries/rules/crafting/poison_crafting.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Poison Crafting\n\nProficiency with a **Poisoner's Kit** allows you to harvest venom and create deadly toxins without risking exposure....` |

### `public/data/glossary/entries/rules/obscured_areas.json`

| Line | Snippet |
|---|---|
| 10 | `"markdown": "# Obscured Areas\r\n<p class=\"glossary-intro-quote\">An area might be Lightly or Heavily Obscured, which can hinder creatures that rely ...` |

### `public/data/glossary/entries/rules/vision.json`

| Line | Snippet |
|---|---|
| 10 | `"markdown": "# Vision\n\nVision is the primary way most creatures perceive their surroundings. A creature's ability to see is governed by the lighting...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 377 | `"title": "Blinded",` |
| 381 | `"blinded",` |
| 384 | `"excerpt": "A blinded creature can't see and automatically fails ability checks requiring sight. Attack rolls against the creature have Advantage, and...` |

### `public/data/spells/level-1/color-spray.json`

| Line | Snippet |
|---|---|
| 103 | `"description": "Roll 6d10 (plus scaling by slot). Starting with the lowest current HP creatures in the cone, subtract from the pool until it is deplet...` |
| 165 | `"name": "Blinded",` |
| 195 | `"description": "A dazzling array of flashing, colorful light springs from your hand. Each creature in a 15-foot Cone must succeed on a Constitution sa...` |

### `public/data/spells/level-2/beast-sense.json`

| Line | Snippet |
|---|---|
| 140 | `"description": "You touch a willing Beast. For the duration of the spell, you can use your action to see through the Beast's eyes and hear what it hea...` |

### `public/data/spells/level-2/blindness-deafness.json`

| Line | Snippet |
|---|---|
| 104 | `"name": "Blinded",` |
| 121 | `"description": "On a failed save, target is either Blinded (default) or Deafened (player choice) for the duration. Repeats Con save at end of each tur...` |
| 134 | `"description": "You can Clone a foe's eyes or ears. Choose one creature that you can see within range to make a Constitution saving throw. If it fails...` |

### `public/data/spells/level-2/lesser-restoration.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed, or...` |
| 141 | `"description": "You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed, or...` |

### `public/data/spells/level-2/pyrotechnics.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "Fireworks: extinguish the flame; each creature in a 10-foot radius makes a Con save or is blinded until end of your next turn.",` |
| 203 | `"description": "Choose an area of flame that fits in a 5-foot cube within range. You can extinguish the fire in that area, creating either fireworks (...` |

### `public/data/spells/level-3/blinding-smite.json`

| Line | Snippet |
|---|---|
| 143 | `"name": "Blinded",` |
| 173 | `"description": "The next time you hit a creature with a melee weapon attack during this spell's duration, your weapon flares with bright light, and th...` |

### `public/data/spells/level-3/feign-death.json`

| Line | Snippet |
|---|---|
| 104 | `"name": "Blinded",` |
| 190 | `"description": "You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the duration, the target has...` |

### `public/data/spells/level-3/hunger-of-hadar.json`

| Line | Snippet |
|---|---|
| 117 | `"description": "You open a gateway to the dark between the stars, a region infested with unknown horrors. A 20-foot-radius sphere of blackness and bit...` |

### `public/data/spells/level-3/wall-of-sand.json`

| Line | Snippet |
|---|---|
| 101 | `"name": "Blinded",` |
| 131 | `"description": "You create a wall of swirling sand on the ground at a point you can see within range. You can make the wall up to 30 feet long, 10 fee...` |

### `public/data/spells/level-4/aura-of-purity.json`

| Line | Snippet |
|---|---|
| 141 | `"description": "Purifying energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) can't ...` |

### `public/data/spells/level-5/holy-weapon.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You imbue a weapon you touch with holy power. Until the spell ends, the weapon emits bright light in a 30-foot radius and dim light fo...` |
| 138 | `"description": "You imbue a weapon you touch with holy power. Until the spell ends, the weapon emits bright light in a 30-foot radius and dim light fo...` |

### `public/data/spells/level-5/mislead.json`

| Line | Snippet |
|---|---|
| 103 | `"description": "You become Invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration...` |
| 139 | `"description": "You become Invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration...` |

### `public/data/spells/level-5/wall-of-light.json`

| Line | Snippet |
|---|---|
| 145 | `"name": "Blinded",` |
| 175 | `"description": "A shimmering wall of bright light appears at a point you choose within range. The wall appears in any orientation you choose: horizont...` |

### `public/data/spells/level-6/sunbeam.json`

| Line | Snippet |
|---|---|
| 119 | `"description": "A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-line. Each creature in the line must make a Constitutio...` |

### `public/data/spells/level-7/draconic-transformation.json`

| Line | Snippet |
|---|---|
| 119 | `"description": "With a roar, you draw on the magic of dragons to transform yourself, taking on draconic features. You gain the following benefits unti...` |

### `public/data/spells/level-8/holy-aura.json`

| Line | Snippet |
|---|---|
| 101 | `"description": "For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving th...` |
| 137 | `"description": "For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving th...` |

### `public/data/spells/level-8/sunburst.json`

| Line | Snippet |
|---|---|
| 122 | `"description": "Brilliant sunlight flashes in a 60-foot radius centered on a point you choose within range. Each creature in that light must make a Co...` |

### `public/data/spells/level-9/mass-heal.json`

| Line | Snippet |
|---|---|
| 101 | `"description": "A flood of healing energy flows from you into creatures around you. You restore up to 700 Hit Points, divided as you choose among any ...` |
| 137 | `"description": "A flood of healing energy flows from you into creatures around you. You restore up to 700 Hit Points, divided as you choose among any ...` |

### `public/data/spells/level-9/prismatic-wall.json`

| Line | Snippet |
|---|---|
| 104 | `"description": "A shimmering, multicolored plane of light forms a vertical opaque wall-up to 90 feet long, 30 feet high, and 1 inch thick-centered on ...` |
| 140 | `"description": "A shimmering, multicolored plane of light forms a vertical opaque wall-up to 90 feet long, 30 feet high, and 1 inch thick-centered on ...` |

