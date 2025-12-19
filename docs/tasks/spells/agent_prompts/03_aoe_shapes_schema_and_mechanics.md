# Agent Prompt 03 - AoE Shapes (emanation/wall/hemisphere/circle/line+ring): Confirm Mechanics + Implement SSOT Representation

Repo: `AraliaV4/Aralia`

Goal: Make AoE shapes and semantics representable in spell JSON as SSOT for both mechanics and glossary display.

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Problem
Reference files use AoE shapes not faithfully representable in current schema:
- `emanation`, `wall`, `hemisphere`, `circle`, `line, ring`

Current targeting schema supports:
- `targeting.areaOfEffect.shape` in `Cone|Cube|Cylinder|Line|Sphere|Square`
- `size` + optional `height`

Some of the above require extra parameters/semantics:
- Emanation: centered on caster and follows caster
- Wall: length/height/orientation/thickness; persistent zone; triggers when entering or starting turn in area
- Hemisphere: dome shape
- Circle: often "ground circle"; closer to cylinder semantics
- Line/ring: cast-time variant choice

## Investigate existing code mechanics
Search/inspect these files first:
- Targeting selection / AoE math:
  - `src/hooks/combat/useTargeting.ts`
  - `src/utils/combatUtils.ts`
  - `src/utils/spellAbilityFactory.ts`
- Persistent zones and triggers:
  - `src/systems/spells/effects/AreaEffectTracker.ts`
  - `src/systems/spells/effects/triggerHandler.ts`
- Terrain/walls:
  - Search for `terrainType`, `wallProperties`, "blocking", "wall", "zone", "areaOfEffect"

## Decide and implement schema representation
Pick one approach:

### Option A: Extend existing `areaOfEffect`
- Extend `targeting.areaOfEffect.shape` enum to include shapes like `Wall`, `Emanation`, `Hemisphere`, `Ring`, etc.
- Add dimension fields required for each.

### Option B: Add `targeting.advancedAreaOfEffect` (recommended if minimizing breakage)
- Keep current `areaOfEffect` for simple shapes.
- Add a discriminated union block that can represent complex AoE types:
  - `emanation` (radius, followsCaster: true)
  - `wall` (length, height, thickness, orientation)
  - `hemisphere` (radius)
  - `circle` (radius, groundLocked: true)
  - `lineOrRing` (choice set + chosen variant)

## Update the whole system (schema + runtime + rendering)
Implement end-to-end changes:
- Schema:
  - `src/systems/spells/validation/spellValidator.ts`
  - `src/systems/spells/schema/spell.schema.json`
- Types:
  - `src/types/spells.ts`
- Runtime mechanics:
  - Targeting selection & validation
  - Zone persistence (if required)
  - Trigger behavior in zones (enter/turn-start/turn-end)
- Reference-to-JSON mapping:
  - Update `scripts/update-spell-json-from-references.ts` to map reference `Area Shape` values (`emanation`, `wall`, `hemisphere`, `circle`, `line, ring`) into the new representation
- Glossary display:
  - Update `src/components/Glossary/SpellCardTemplate.tsx` to clearly render these AoE semantics (suggest: an "Area" section that shows shape + dimensions + "follows caster"/orientation notes)

## Concrete spells to use as fixtures
Update at least 2 spells to use the new representation and verify mechanics:
- `emanation`: `arms-of-hadar`, `spirit-guardians`, `antilife-shell`
- `hemisphere`: `leomunds-tiny-hut`
- `wall`: `wall-of-ice`, `wall-of-thorns`, `blade-barrier`, `prismatic-wall`, `tsunami`
- `circle`: `earthquake`
- `line, ring`: `wall-of-fire`

## Commands
- `npm run validate` (must pass at end)
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`

## Deliverable
- A clear schema decision implemented end-to-end.
- At least 2 spells migrated to the new AoE model and validated.
- A plan for bulk rollout to all affected spells after fixture verification, including:
  - list of all spells impacted
  - migration steps (data + schema + UI)
  - checkpoints for user review/approval of any semantics ambiguities
- If you find duplicated or conflicting AoE/zone mechanics across multiple files, include a brief report:
  - which files implement overlapping logic
  - which one should be the SSOT
  - a consolidation plan (separate from the AoE schema change if needed)
