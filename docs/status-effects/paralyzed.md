# Paralyzed Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 17 | `'Paralyzed': '⚡',` |

### `src/data/gatherableItems.ts`

| Line | Snippet |
|---|---|
| 219 | `description: 'Paralyzing mucus from a carrion crawler. DC 13 Con save or Poisoned + Paralyzed.',` |

### `src/data/races/autognome.ts`

| Line | Snippet |
|---|---|
| 21 | `'Mechanical Nature: You have resistance to poison, immunity to disease, and advantage on saves against being paralyzed or poisoned. You don’t need to ...` |

### `src/systems/combat/reactions/OpportunityAttackSystem.ts`

| Line | Snippet |
|---|---|
| 59 | `// Check if attacker can physically take a reaction (Alive, Conscious, Not Incapacitated/Stunned/Paralyzed)` |

### `src/systems/combat/reactions/__tests__/OpportunityAttackSystem_Conditions.test.ts`

| Line | Snippet |
|---|---|
| 22 | `it('should prevent OA if attacker is Paralyzed', () => {` |
| 24 | `// Apply Paralyzed condition (using legacy statusEffects for now as that is what systems use primarily, but should test both)` |
| 27 | `name: 'Paralyzed',` |
| 34 | `name: 'Paralyzed',` |
| 44 | `// Should be empty because Paralyzed creatures can't take reactions` |

### `src/systems/crafting/creatureHarvestData.ts`

| Line | Snippet |
|---|---|
| 93 | `description: 'Paralyzing mucus. DC 13 Con save or Poisoned + Paralyzed for 1 minute.'` |
| 109 | `description: 'DC 13 Con save or Poisoned + Paralyzed for 1 minute.'` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 17 | `Paralyzed = "Paralyzed",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 17 | `Paralyzed = 'Paralyzed',` |
| 113 | `[ConditionType.Paralyzed]: {` |

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
| 467 | `paralyzed: { id: 'paralyzed', label: 'Paralyzed', icon: '⚡', color: '#FBBF24', description: 'Incapacitated and can’t move or speak. Attacks against th...` |

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
| 188 | `\| 'paralyzed'` |

### `docs/spells/reference/level-2/hold-person.md`

| Line | Snippet |
|---|---|
| 32 | `- **Conditions Applied**: Paralyzed` |
| 34 | `- **Description**: Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be Paralyzed for the duration....` |

### `docs/spells/reference/level-2/lesser-restoration.md`

| Line | Snippet |
|---|---|
| 28 | `- **Description**: You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed,...` |

### `docs/spells/reference/level-4/aura-of-purity.md`

| Line | Snippet |
|---|---|
| 29 | `- **Description**: Purifying energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) can...` |

### `docs/spells/reference/level-4/freedom-of-movement.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magi...` |

### `docs/spells/reference/level-5/hold-monster.md`

| Line | Snippet |
|---|---|
| 33 | `- **Condition**: Paralyzed` |
| 35 | `- **Description**: Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition f...` |

### `docs/spells/reference/level-9/power-word-heal.md`

| Line | Snippet |
|---|---|
| 29 | `- **Description**: A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature ...` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/monk_subclasses/warrior_of_mercy.json`

| Line | Snippet |
|---|---|
| 20 | `"markdown": "# Warrior of Mercy\r\n\r\n**Manipulate Forces of Life and Death**\r\n\r\nWarriors of Mercy manipulate the life force of others. These Mon...` |

### `public/data/glossary/entries/classes/paladin.json`

| Line | Snippet |
|---|---|
| 29 | `"markdown": "# Paladin\r\n\r\n<div class=\"not-prose my-6\">\r\n  <table class=\"min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg...` |

### `public/data/glossary/entries/races/autognome.json`

| Line | Snippet |
|---|---|
| 47 | `"description": "You have resistance to [[poison_damage\|poison damage]] and immunity to disease, and you have [[advantage]] on saving throws against b...` |

### `public/data/glossary/entries/rules/conditions/paralyzed_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Paralyzed",` |
| 7 | `"paralyzed",` |
| 10 | `"excerpt": "A paralyzed creature is Incapacitated, can't move or speak, and automatically fails Strength and Dexterity saving throws. Attacks against ...` |
| 17 | `"markdown": "# Paralyzed\r\n\r\nWhile you have the Paralyzed condition, you experience the following effects:\r\n\r\n*   **Incapacitated.** You have t...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 1776 | `"title": "Paralyzed",` |
| 1780 | `"paralyzed",` |
| 1783 | `"excerpt": "A paralyzed creature is Incapacitated, can't move or speak, and automatically fails Strength and Dexterity saving throws. Attacks against ...` |

### `public/data/spells/level-2/hold-person.json`

| Line | Snippet |
|---|---|
| 108 | `"name": "Paralyzed",` |
| 138 | `"description": "Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be Paralyzed for the duration. At...` |

### `public/data/spells/level-2/lesser-restoration.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed, or...` |
| 141 | `"description": "You touch a creature and end either one disease or one condition adhering to it. The condition can be Blinded, Deafened, Paralyzed, or...` |

### `public/data/spells/level-4/aura-of-purity.json`

| Line | Snippet |
|---|---|
| 141 | `"description": "Purifying energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) can't ...` |

### `public/data/spells/level-4/freedom-of-movement.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |
| 141 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |

### `public/data/spells/level-5/hold-monster.json`

| Line | Snippet |
|---|---|
| 104 | `"description": "Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for ...` |
| 140 | `"description": "Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for ...` |

### `public/data/spells/level-9/power-word-heal.json`

| Line | Snippet |
|---|---|
| 102 | `"description": "A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature has...` |
| 138 | `"description": "A wave of healing energy washes over one creature you can see within range. The target regains all its Hit Points. If the creature has...` |

