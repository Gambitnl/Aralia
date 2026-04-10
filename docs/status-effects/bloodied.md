# Bloodied Status References

## Code Files (.ts, .tsx, .js, .jsx)

### `src/systems/planar/PortalSystem.ts`

| Line | Snippet |
|---|---|
| 64 | `if (req.value === 'Bloodied') {` |
| 66 | `if (!isBloodied) return { met: false, reason: "A sacrifice of vitality (Bloodied) is required." };` |

### `src/systems/planar/__tests__/PortalSystem.test.ts`

| Line | Snippet |
|---|---|
| 59 | `it('should check for Bloodied condition', () => {` |
| 62 | `activationRequirements: [{ type: 'condition', value: 'Bloodied', description: 'Sacrifice required' }]` |

### `src/types/combat.d.ts`

| Line | Snippet |
|---|---|
| 21 | `hpStatus?: 'full' \| 'bloodied' \| 'unconscious';` |

### `src/types/combat.ts`

| Line | Snippet |
|---|---|
| 29 | `hpStatus?: 'full' \| 'bloodied' \| 'unconscious';` |

### `src/types/planes.ts`

| Line | Snippet |
|---|---|
| 78 | `value: string; // "Moonstone Key", "Full Moon", "Plane Shift", "Bloodied"` |

### `src/utils/planar/planarUtils.ts`

| Line | Snippet |
|---|---|
| 67 | `// Example: "Bloodied" - check if any party member is < 50% HP` |
| 68 | `if (req.value === 'Bloodied') {` |

## JSON Data Files (.json)

### `public/data/glossary/entries/classes/cleric_subclasses/life_domain.json`

| Line | Snippet |
|---|---|
| 23 | `"markdown": "# Life Domain\r\n\r\n**Soothe the Hurts of the World**\r\n\r\nThe Life Domain focuses on the positive energy that helps sustain all life ...` |

### `public/data/glossary/entries/classes/fighter_subclasses/champion.json`

| Line | Snippet |
|---|---|
| 19 | `"markdown": "# Champion\r\n\r\n**Pursue Physical Excellence in Combat**\r\n\r\nA Champion focuses on the development of martial prowess in a relentles...` |

