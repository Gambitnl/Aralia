# Spell Data Schema Conventions

This document defines the rules and conventions for spell JSON files.

---

## File Location
- Spells are stored in `public/data/spells/level-{N}/` by spell level
- Filename: kebab-case matching the spell ID (e.g., `fire-bolt.json`)

---

## Field Conventions

### `targeting.range`
| `range.type` | `targeting.range` value |
|--------------|------------------------|
| `"touch"` | Always `5` |
| `"self"` (buff/weapon) | `5` |
| `"self"` (AoE emanation) | `0` |
| `"self"` (extended reach) | Actual range (e.g., `15` for Lightning Lure) |
| `"ranged"` | Match `range.distance` |

### `targeting.lineOfSight`
- **Always define this field** - don't leave undefined
- `true` for most spells targeting creatures/points
- `false` only for self-buffs or spells explicitly ignoring cover (Message)

### `targeting.type` values
| Value | Use case |
|-------|----------|
| `"self"` | Buffs yourself only |
| `"single"` | One target |
| `"multi"` | Multiple targets (like Eldritch Blast beams) |
| `"area"` | AoE with `areaOfEffect` defined |
| `"point"` | Targets a point in space (not a creature) |
| `"melee"` | Melee weapon attack spells |
| `"ranged"` | Ranged attack at distance |

### `tags`
- All cantrips (level 0) must include `"cantrip"` tag
- Include damage type if applicable (`"fire"`, `"cold"`, etc.)
- Include functional category (`"damage"`, `"utility"`, `"buff"`, `"control"`)

### `range.type` vs `targeting.type`
- `range.type` = D&D's RAW range category (self/touch/ranged)
- `targeting.type` = What you can actually target with the spell
- These may differ (e.g., `range.type: "self"` with `targeting.type: "melee"`)

---

## Legacy/Optional Fields

| Field | When to use |
|-------|-------------|
| `source` | Only for non-PHB spells (e.g., "Tasha's Cauldron of Everything") |
| `legacy` | `true` if spell not in 2024 PHB |
| `attackType` | `"melee"` or `"ranged"` for spells requiring attack rolls |
| `arbitrationType` | `"player_choice"` for spells with multiple effect options |
| `_todo` | Array of unimplemented mechanics needing development |

---

## AoE Spells

Use `targeting.areaOfEffect` (not legacy `targeting.shape`/`targeting.radius`):

```json
"areaOfEffect": {
  "shape": "Sphere",  // Cone, Cube, Cylinder, Line, Sphere, Square
  "size": 5
}
```
