# Grappled Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/config/statusIcons.ts`

| Line | Snippet |
|---|---|
| 14 | `'Grappled': '✊',` |

### `src/data/feats/featsData.ts`

| Line | Snippet |
|---|---|
| 594 | `description: 'Your body is a weapon, refined through brutal conditioning until fists hit harder than some swords. Unarmed strikes deal 1d8 damage (1d6...` |

### `src/data/navalManeuvers.ts`

| Line | Snippet |
|---|---|
| 80 | `successEffect: 'Ships become Grappled. Crew combat begins.',` |

### `src/data/races/cloud_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/data/races/fire_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/data/races/frost_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/data/races/goliath.ts`

| Line | Snippet |
|---|---|
| 57 | `'Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |

### `src/data/races/hill_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/data/races/stone_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/data/races/storm_giant_goliath.ts`

| Line | Snippet |
|---|---|
| 19 | `'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your c...` |

### `src/systems/naval/NavalCombatSystem.ts`

| Line | Snippet |
|---|---|
| 241 | `id: 'grappled',` |
| 242 | `name: 'Grappled',` |
| 249 | `name: 'Grappled',` |
| 254 | `result.details += ` Ships are now grappled!`;` |

### `src/types/conditions.d.ts`

| Line | Snippet |
|---|---|
| 14 | `Grappled = "Grappled",` |

### `src/types/conditions.ts`

| Line | Snippet |
|---|---|
| 14 | `Grappled = 'Grappled',` |
| 88 | `[ConditionType.Grappled]: {` |

### `src/types/navalCombat.ts`

| Line | Snippet |
|---|---|
| 27 | `grappledWith?: string[]; // IDs of ships grappled with` |

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
| 464 | `grappled: { id: 'grappled', label: 'Grappled', icon: '✊', color: '#D97706', description: 'Speed becomes 0, and it can’t benefit from any bonus to its ...` |

## Documentation & Markdown (.md)

### `.jules/guides/dnd-domain.md`

| Line | Snippet |
|---|---|
| 185 | `\| 'grappled'` |

### `docs/spells/reference/level-4/freedom-of-movement.md`

| Line | Snippet |
|---|---|
| 32 | `- **Description**: You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magi...` |

### `docs/spells/reference/level-4/grasping-vine.md`

| Line | Snippet |
|---|---|
| 30 | `- **Conditions Applied**: Grappled` |
| 32 | `- **Description**: You conjure a vine that sprouts from a surface in an unoccupied space that you can see within range. The vine lasts for the duratio...` |

### `docs/tasks/feat-system-gaps.md`

| Line | Snippet |
|---|---|
| 137 | `\| Grappler \| Advantage vs grappled, restrain option \| Needs grapple system \|` |

### `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`

| Line | Snippet |
|---|---|
| 60 | `- **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitat...` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/sorcerer_subclasses/aberrant_sorcery.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Aberrant Mind\r\n\r\n**Wield Unnatural Psionic Power**\r\n\r\nAn alien influence has wrapped its tendrils around your mind, giving you ...` |

### `public/data/glossary/entries/rules/conditions/grappled_condition.json`

| Line | Snippet |
|---|---|
| 3 | `"title": "Grappled",` |
| 7 | `"grappled",` |
| 10 | `"excerpt": "A grappled creature's speed becomes 0, and it has Disadvantage on attack rolls against any target other than the grappler.",` |
| 16 | `"markdown": "# Grappled\r\n\r\nWhile you have the Grappled condition, you experience the following effects:\r\n\r\n*   **Speed 0.** Your <span data-te...` |

### `public/data/glossary/entries/rules/unarmed_strike.json`

| Line | Snippet |
|---|---|
| 12 | `"markdown": "# Unarmed Strike\n\nInstead of using a weapon to make a melee weapon attack, you can use an unarmed strike: a punch, kick, head-butt, or ...` |

### `public/data/glossary/index/rules_glossary.json`

| Line | Snippet |
|---|---|
| 1195 | `"title": "Grappled",` |
| 1199 | `"grappled",` |
| 1202 | `"excerpt": "A grappled creature's speed becomes 0, and it has Disadvantage on attack rolls against any target other than the grappler.",` |

### `public/data/spells/level-4/freedom-of-movement.json`

| Line | Snippet |
|---|---|
| 105 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |
| 141 | `"description": "You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical...` |

### `public/data/spells/level-4/grasping-vine.json`

| Line | Snippet |
|---|---|
| 144 | `"name": "Grappled",` |
| 174 | `"description": "You conjure a vine that sprouts from a surface in an unoccupied space that you can see within range. The vine lasts for the duration. ...` |

### `scripts/audits/base-trait-coverage.report.json`

| Line | Snippet |
|---|---|
| 171 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |
| 182 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |
| 193 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |
| 204 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |
| 215 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |
| 226 | `"Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining yo...` |

