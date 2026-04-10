# Exhaustion Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 24 | `'Exhaustion': '😫',` |

### `src/data/biomes.ts`

| Line | Snippet |
|---|---|
| 96 | `hazards: ['sandstorm', 'heat-exhaustion', 'quicksand'],` |

### `src/data/craftedItems.ts`

| Line | Snippet |
|---|---|
| 398 | `effect: utilityEffect('One-minute Haste effect without post-exhaustion.'),` |

### `src/data/item_templates/index.ts`

| Line | Snippet |
|---|---|
| 80 | `restoresStamina: { type: 'boolean', description: 'Does this item restore stamina or remove exhaustion?' },` |

### `src/hooks/actions/handleMovement.ts`

| Line | Snippet |
|---|---|
| 485 | `// TODO(Navigator): Use `calculateForcedMarchStatus` from `src/systems/travel/TravelCalculations.ts` to check if the party has traveled > 8 hours and ...` |

### `src/hooks/combat/useCombatAI.ts`

| Line | Snippet |
|---|---|
| 159 | `// Action failed (e.g., resource exhaustion not caught by planner).` |

### `src/systems/travel/TravelCalculations.ts`

| Line | Snippet |
|---|---|
| 61 | `* - For each hour beyond 8, characters risk exhaustion.` |
| 71 | `// RALPH: Exhaustion Risk Calculation.` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 12 | `Exhaustion = "Exhaustion",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 12 | `Exhaustion = 'Exhaustion',` |
| 70 | `[ConditionType.Exhaustion]: {` |

### `src/types/creatures.ts`

| Line | Snippet |
|---|---|
| 47 | `conditionImmunities: ['Charmed', 'Exhaustion', 'Frightened', 'Paralyzed', 'Petrified', 'Poisoned'],` |
| 55 | `conditionImmunities: ['Exhaustion', 'Paralyzed', 'Petrified', 'Poisoned', 'Unconscious'],` |
| 74 | `conditionImmunities: ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Prone'],` |

### `src/types/spells.d.ts`

| Line | Snippet |
|---|---|
| 282 | `export type ConditionName = "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened" \| "Grappled" \| "Incapacitated" \| "Invisible" \| "P...` |

### `src/types/spells.ts`

| Line | Snippet |
|---|---|
| 456 | `\| "Blinded" \| "Charmed" \| "Deafened" \| "Exhaustion" \| "Frightened"` |

### `src/types/visuals.ts`

| Line | Snippet |
|---|---|
| 474 | `exhaustion: { id: 'exhaustion', label: 'Exhaustion', icon: '😫', color: '#7C2D12', description: 'Effects vary by level of exhaustion.' }, // orange-90...` |

### `src/utils/combat/combatUtils.ts`

| Line | Snippet |
|---|---|
| 62 | `// 2. Exhaustion effect application that should modify combat stats` |

### `src/utils/combat/physicsUtils.ts`

| Line | Snippet |
|---|---|
| 351 | `* Calculates penalties for Exhaustion levels based on D&D 2024 Rules.` |
| 358 | `* @param level - The current exhaustion level (0-6).` |

### `src/utils/core/securityUtils.ts`

| Line | Snippet |
|---|---|
| 34 | `// 1. Truncate to maximum length to prevent token exhaustion/DoS` |
| 68 | `// 1. Truncate to maximum length to prevent token exhaustion/DoS` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 183 | `\| 'exhaustion'` |

### `.jules/personas/37_taxonomist.md`

| Line | Snippet |
|---|---|
| 39 | `conditionImmunities: [Condition.Poisoned, Condition.Exhaustion],` |

### `docs/spells/reference/level-5/greater-restoration.md`

| Line | Snippet |
|---|---|
| 30 | `- **Description**: You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condit...` |

### `docs/spells/reference/level-6/tensers-transformation.md`

| Line | Snippet |
|---|---|
| 42 | `Immediately after the spell ends, you must succeed on a DC 15 Constitution saving throw or suffer one level of exhaustion.` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

### `src/systems/travel/Travel_Ralph.md`

| Line | Snippet |
|---|---|
| 7 | `- **TravelCalculations.ts**: The physics of travel. Calculates "Forced March" exhaustion DC and "Group Speed" (limited by the slowest member/vehicle)....` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/monk.json`

| Line | Snippet |
|---|---|
| 32 | `"markdown": "# Monk\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg sh...` |

### `public/data/glossary/entries/classes/ranger.json`

| Line | Snippet |
|---|---|
| 33 | `"markdown": "# Ranger\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg ...` |

### `public/data/glossary/entries/rules/conditions/exhaustion_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Exhaustion",` |
| 7 | `"exhaustion",` |
| 10 | `"excerpt": "Exhaustion is a cumulative condition with multiple levels. Each level imposes penalties to D20 tests and speed.",` |
| 16 | `"markdown": "# Exhaustion\r\n\r\nWhile you have the Exhaustion condition, you experience the following effects:\r\n\r\n*   **Exhaustion Levels.** This...` |

### `public/data/glossary/entries/rules/conditions_dont_stack.json`

| Line | Snippet |
|---|---|
| 10 | `"excerpt": "If multiple effects impose the same condition, the effects don't get worse. The Exhaustion condition is an exception.",` |
| 17 | `"markdown": "# Conditions Don't Stack\r\n\r\nIf multiple effects impose the same condition on you, each instance of the condition has its own duration...` |

### `public/data/glossary/entries/rules/constitution.json`

| Line | Snippet |
|---|---|
| 16 | `"markdown": "# Constitution\n\nConstitution measures health, stamina, and vital force.\n\n## Constitution Checks\n\nConstitution checks are uncommon, ...` |

### `public/data/glossary/entries/rules/crafting/alchemy_crafting.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Alchemy Crafting\n\nProficiency with **Alchemist's Supplies** allows you to produce useful concoctions, such as potions and oils.\n\n##...` |

### `public/data/glossary/entries/rules/crafting/herbalism_gathering.json`

| Line | Snippet |
|---|---|
| 21 | `"markdown": "# Herbalism & Gathering\n\nProficiency with an **Herbalism Kit** allows you to identify magical and nonmagical plants, harvest them safel...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 722 | `"excerpt": "If multiple effects impose the same condition, the effects don't get worse. The Exhaustion condition is an exception.",` |
| 1051 | `"title": "Exhaustion",` |
| 1055 | `"exhaustion",` |
| 1058 | `"excerpt": "Exhaustion is a cumulative condition with multiple levels. Each level imposes penalties to D20 tests and speed.",` |

### `public/data/spells/level-5/greater-restoration.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condition...` |
| 141 | `"description": "You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level; The Charmed or Petrified condition...` |

