# Petrified Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 18 | `'Petrified': '🗿',` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 18 | `Petrified = "Petrified",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 18 | `Petrified = 'Petrified',` |
| 124 | `[ConditionType.Petrified]: {` |

### `src/types/creatures.ts`

| Line | Snippet |
|---|---|
| 47 | `conditionImmunities: ['Charmed', 'Exhaustion', 'Frightened', 'Paralyzed', 'Petrified', 'Poisoned'],` |
| 55 | `conditionImmunities: ['Exhaustion', 'Paralyzed', 'Petrified', 'Poisoned', 'Unconscious'],` |

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
| 468 | `petrified: { id: 'petrified', label: 'Petrified', icon: '🗿', color: '#4B5563', description: 'Transformed into a solid inanimate substance (usually st...` |

### `src/utils/combat/combatUtils.ts`

| Line | Snippet |
|---|---|
| 73 | `* - Evaluates incapacitating conditions (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious)` |
| 94 | `// Conditions that prevent reactions: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious` |
| 96 | `const incapacitatedConditions: string[] = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 189 | `\| 'petrified'` |

### `docs/spells/reference/level-1/hex.md`

| Line | Snippet |
|---|---|
| 20 | `- **Material Description**: the petrified eye of a newt` |

### `docs/spells/reference/level-5/greater-restoration.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condit...` |

### `docs/spells/reference/level-6/flesh-to-stone.md`

| Line | Snippet |
|---|---|
| 36 | `- **Description**: You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must...` |

### `docs/spells/reference/level-7/prismatic-spray.md`

| Line | Snippet |
|---|---|
| 41 | `\| 6 \| Indigo. Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it succ...` |

### `docs/spells/reference/level-9/prismatic-wall.md`

| Line | Snippet |
|---|---|
| 37 | `- **Indigo**: Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it succes...` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/rules/conditions/petrified_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Petrified",` |
| 7 | `"petrified",` |
| 10 | `"excerpt": "A petrified creature is transformed into a solid inanimate substance. It is Incapacitated, can't move or speak, has resistance to all dama...` |
| 17 | `"markdown": "# Petrified\r\n\r\nWhile you have the Petrified condition, you experience the following effects:\r\n\r\n*   **Turned to Inanimate Substan...` |

### `public/data/glossary/entries/rules/crafting/herbalism_gathering.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Herbalism & Gathering\n\nProficiency with an **Herbalism Kit** allows you to identify magical and nonmagical plants, harvest them safel...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 1803 | `"title": "Petrified",` |
| 1807 | `"petrified",` |
| 1810 | `"excerpt": "A petrified creature is transformed into a solid inanimate substance. It is Incapacitated, can't move or speak, has resistance to all dama...` |

### `public/data/spells/level-1/hex.json`

| Line | Snippet |
|---|---|
| 36 | `"materialDescription": "the petrified eye of a newt",` |

### `public/data/spells/level-5/greater-restoration.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condition...` |
| 141 | `"description": "You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condition...` |

### `public/data/spells/level-6/flesh-to-stone.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must ma...` |
| 138 | `"description": "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must ma...` |

